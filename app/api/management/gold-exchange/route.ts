import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { goldAssets, transactions } from '@/lib/db/schema';
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

    const { userId, amount, goldType = 'ทองสมาคม 96.5%' } = await request.json();

    if (!userId || !amount) {
      return NextResponse.json(
        { error: 'User ID and amount are required' },
        { status: 400 }
      );
    }

    // Start a transaction
    const result = await db.transaction(async (tx) => {
      // Check if admin has enough gold
      const [adminGold] = await tx
        .select({
          totalAmount: sql<string>`COALESCE(sum(${goldAssets.amount}), '0')`
        })
        .from(goldAssets)
        .where(
          and(
            eq(goldAssets.userId, user.id),
            eq(goldAssets.goldType, goldType)
          )
        );

      const adminGoldAmount = Number(adminGold?.totalAmount || 0);
      
      if (adminGoldAmount < Number(amount)) {
        throw new Error(`Insufficient gold stock. Available: ${adminGoldAmount}`);
      }

      // Get current gold price for the transaction
      const [adminGoldAsset] = await tx
        .select()
        .from(goldAssets)
        .where(
          and(
            eq(goldAssets.userId, user.id),
            eq(goldAssets.goldType, goldType)
          )
        )
        .orderBy(goldAssets.createdAt)
        .limit(1);

      const currentPrice = adminGoldAsset ? Number(adminGoldAsset.purchasePrice) : 0;

      // Create a transaction record
      await tx.insert(transactions).values({
        userId: Number(userId),
        goldType,
        amount,
        pricePerUnit: currentPrice.toString(),
        totalPrice: (Number(amount) * currentPrice).toString(),
        type: 'exchange', // New transaction type for exchanges
      });

      // Check if user has gold assets of this type
      const [userGold] = await tx
        .select()
        .from(goldAssets)
        .where(
          and(
            eq(goldAssets.userId, Number(userId)),
            eq(goldAssets.goldType, goldType)
          )
        )
        .limit(1);

      if (userGold) {
        // Update existing gold asset
        await tx
          .update(goldAssets)
          .set({
            amount: sql`${goldAssets.amount} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(eq(goldAssets.id, userGold.id));
      } else {
        // Create new gold asset for user
        await tx.insert(goldAssets).values({
          userId: Number(userId),
          goldType,
          amount,
          purchasePrice: currentPrice.toString(),
        });
      }

      // Reduce admin's gold stock
      // Find admin's gold assets and reduce from them
      const adminAssets = await tx
        .select()
        .from(goldAssets)
        .where(
          and(
            eq(goldAssets.userId, user.id),
            eq(goldAssets.goldType, goldType)
          )
        )
        .orderBy(goldAssets.createdAt);

      let remainingAmountToReduce = Number(amount);
      
      for (const asset of adminAssets) {
        const assetAmount = Number(asset.amount);
        if (assetAmount <= 0) continue;

        const amountToReduceFromAsset = Math.min(assetAmount, remainingAmountToReduce);
        
        if (amountToReduceFromAsset > 0) {
          await tx
            .update(goldAssets)
            .set({
              amount: sql`${goldAssets.amount} - ${amountToReduceFromAsset}`,
              updatedAt: new Date(),
            })
            .where(eq(goldAssets.id, asset.id));

          remainingAmountToReduce -= amountToReduceFromAsset;
        }

        if (remainingAmountToReduce <= 0) break;
      }

      // Get updated admin gold amount
      const [updatedAdminGold] = await tx
        .select({
          totalAmount: sql<string>`COALESCE(sum(${goldAssets.amount}), '0')`
        })
        .from(goldAssets)
        .where(
          and(
            eq(goldAssets.userId, user.id),
            eq(goldAssets.goldType, goldType)
          )
        );

      // Get updated user gold amount
      const [updatedUserGold] = await tx
        .select({
          totalAmount: sql<string>`COALESCE(sum(${goldAssets.amount}), '0')`
        })
        .from(goldAssets)
        .where(
          and(
            eq(goldAssets.userId, Number(userId)),
            eq(goldAssets.goldType, goldType)
          )
        );

      return {
        success: true,
        remainingStock: updatedAdminGold?.totalAmount || '0',
        userGoldAmount: updatedUserGold?.totalAmount || '0'
      };
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