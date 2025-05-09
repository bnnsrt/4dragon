import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { goldAssets, users, transactions } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq, and, sql } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher';

export async function POST(request: Request) {
  try {
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { customerId, goldType, amount } = await request.json();

    if (!customerId || !goldType || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Start a transaction
    const result = await db.transaction(async (tx) => {
      // Check if customer exists
      const customer = await tx
        .select()
        .from(users)
        .where(eq(users.id, customerId))
        .limit(1);

      if (customer.length === 0) {
        throw new Error('Customer not found');
      }

      // Check if admin has enough gold
      const [adminAsset] = await tx
        .select({
          total: sql<string>`COALESCE(sum(${goldAssets.amount}), '0')`
        })
        .from(goldAssets)
        .where(
          and(
            eq(goldAssets.userId, user.id),
            eq(goldAssets.goldType, goldType)
          )
        );

      if (Number(adminAsset.total) < Number(amount)) {
        throw new Error('Insufficient gold balance');
      }

      // Reduce admin's gold (subtract from admin's stock)
      const adminGoldAssets = await tx
        .select()
        .from(goldAssets)
        .where(
          and(
            eq(goldAssets.userId, user.id),
            eq(goldAssets.goldType, goldType)
          )
        )
        .orderBy(goldAssets.createdAt);

      let remainingAmountToSubtract = Number(amount);
      
      for (const asset of adminGoldAssets) {
        const assetAmount = Number(asset.amount);
        if (assetAmount <= 0) continue;

        const amountToSubtractFromAsset = Math.min(assetAmount, remainingAmountToSubtract);
        
        if (amountToSubtractFromAsset > 0) {
          await tx
            .update(goldAssets)
            .set({
              amount: sql`${goldAssets.amount} - ${amountToSubtractFromAsset}`,
              updatedAt: new Date(),
            })
            .where(eq(goldAssets.id, asset.id));

          remainingAmountToSubtract -= amountToSubtractFromAsset;
        }

        if (remainingAmountToSubtract <= 0) break;
      }

      // Add gold to customer's account
      // First check if customer already has this gold type
      const customerAsset = await tx
        .select()
        .from(goldAssets)
        .where(
          and(
            eq(goldAssets.userId, customerId),
            eq(goldAssets.goldType, goldType)
          )
        )
        .limit(1);

      // Get average purchase price from admin's assets
      const [avgPrice] = await tx
        .select({
          avgPrice: sql<string>`CASE 
            WHEN sum(${goldAssets.amount}) > 0 
            THEN sum(${goldAssets.amount} * ${goldAssets.purchasePrice}) / sum(${goldAssets.amount})
            ELSE '0' 
          END`
        })
        .from(goldAssets)
        .where(
          and(
            eq(goldAssets.userId, user.id),
            eq(goldAssets.goldType, goldType)
          )
        );

      const purchasePrice = avgPrice.avgPrice || '0';
      const totalPrice = (Number(amount) * Number(purchasePrice)).toString();

      if (customerAsset.length > 0) {
        // Update existing asset
        await tx
          .update(goldAssets)
          .set({
            amount: sql`${goldAssets.amount} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(goldAssets.id, customerAsset[0].id));
      } else {
        // Create new asset for customer
        await tx.insert(goldAssets).values({
          userId: customerId,
          goldType,
          amount,
          purchasePrice,
        });
      }

      // Record the transaction
      await tx.insert(transactions).values({
        userId: customerId,
        goldType,
        amount,
        pricePerUnit: purchasePrice,
        totalPrice,
        type: 'exchange',
      });

      return { success: true };
    });

    // Trigger Pusher event to update gold data in real-time
    await pusherServer.trigger('gold-transactions', 'exchange', {
      type: 'exchange',
      amount,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error exchanging gold:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to exchange gold' },
      { status: 500 }
    );
  }
}