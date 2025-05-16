import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { goldAssets, transactions, users, userBalances } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq, and, sql, ne } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher';
import { sendGoldPurchaseNotification } from '@/lib/telegram/bot';

const ADMIN_EMAIL = 'adminfortest@gmail.com';
const GOLD_TYPE = 'ทองสมาคม 96.5%';

export async function POST(request: Request) {
  try {
    // Verify user is authenticated and is an admin
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { customerId, goldType, amount, jewelryName } = body;

    // Validate input
    if (!customerId || !goldType || !amount || !jewelryName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Convert amount to number and validate
    const goldAmount = Number(amount);
    if (isNaN(goldAmount) || goldAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid gold amount' },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customerId_num = parseInt(customerId);
    const customer = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, customerId_num)
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Execute operations to ensure data consistency
    let transactionResult;
    try {
      // Create a record of the exchange transaction
      await db.insert(transactions).values({
        userId: customerId_num,
        type: 'EX_JEWELRY', // Shortened to fit within 10 character limit
        amount: goldAmount.toString(),
        goldType: jewelryName, // Store the jewelry name in goldType
        pricePerUnit: '0', // Exchange doesn't have a price per unit
        totalPrice: '0', // Exchange doesn't have a total price
      });

      // Decrease gold from customer's account when they exchange gold jewelry
      // First, check if the customer has this gold type
      const customerAsset = await db.query.goldAssets.findFirst({
        where: (assets, { eq, and }) => and(
          eq(assets.userId, customerId_num),
          eq(assets.goldType, goldType)
        )
      });
      
      // Get average purchase price from admin's gold assets
      const [avgPrice] = await db
        .select({
          avgPrice: sql<string>`CASE 
            WHEN sum(${goldAssets.amount}) > 0 
            THEN sum(${goldAssets.amount} * ${goldAssets.purchasePrice}) / sum(${goldAssets.amount})
            ELSE '30000' 
          END`
        })
        .from(goldAssets)
        .leftJoin(users, eq(goldAssets.userId, users.id))
        .where(
          and(
            eq(users.email, ADMIN_EMAIL),
            eq(goldAssets.goldType, GOLD_TYPE)
          )
        );
      
      const purchasePrice = avgPrice.avgPrice || '30000';
      
      // Verify customer has enough gold to exchange
      if (!customerAsset || Number(customerAsset.amount) < goldAmount) {
        throw new Error(`Customer does not have enough gold. Available: ${customerAsset ? customerAsset.amount : 0} บาท, Requested: ${goldAmount} บาท`);
      }
      
      // Update customer's gold asset (decrease the amount)
      const remainingAmount = Number(customerAsset.amount) - goldAmount;
      
      if (remainingAmount > 0) {
        // Update existing asset with reduced amount
        await db
          .update(goldAssets)
          .set({
            amount: remainingAmount.toString(),
            updatedAt: new Date(),
          })
          .where(eq(goldAssets.id, customerAsset.id));
      } else {
        // Remove the asset entirely if no gold remains
        await db.delete(goldAssets).where(eq(goldAssets.id, customerAsset.id));
      }

      // Calculate admin's total stock after exchange
      const [adminStock] = await db
        .select({
          total: sql<string>`COALESCE(sum(${goldAssets.amount}), '0')`
        })
        .from(goldAssets)
        .leftJoin(users, eq(goldAssets.userId, users.id))
        .where(
          and(
            eq(users.email, ADMIN_EMAIL),
            eq(goldAssets.goldType, GOLD_TYPE)
          )
        );

      // Calculate total user holdings (excluding admin)
      const [userHoldings] = await db
        .select({
          total: sql<string>`COALESCE(sum(${goldAssets.amount}), '0')`
        })
        .from(goldAssets)
        .leftJoin(users, eq(goldAssets.userId, users.id))
        .where(
          and(
            ne(users.email, ADMIN_EMAIL),
            eq(goldAssets.goldType, GOLD_TYPE)
          )
        );

      // Get total balance across all users
      const [totalUserBalance] = await db
        .select({
          total: sql<string>`COALESCE(sum(${userBalances.balance}), '0')`
        })
        .from(userBalances)
        .leftJoin(users, eq(userBalances.userId, users.id))
        .where(ne(users.role, 'admin'));
        
      // Get total balance from transactions history (buy transactions)
      const [transactionsTotal] = await db
        .select({
          total: sql<string>`COALESCE(sum(CASE WHEN ${transactions.type} = 'buy' THEN ${transactions.totalPrice} ELSE 0 END), '0')`
        })
        .from(transactions);
      
      // Get total gold stock value (sum of all admin's gold assets)
      const [totalGoldStockValueResult] = await db
        .select({
          total: sql<string>`COALESCE(sum(${goldAssets.amount} * ${goldAssets.purchasePrice}), '0')`
        })
        .from(goldAssets)
        .leftJoin(users, eq(goldAssets.userId, users.id))
        .where(
          and(
            eq(users.email, ADMIN_EMAIL),
            eq(goldAssets.goldType, GOLD_TYPE)
          )
        );
      
      // Calculate the cash balance as: (total user balance from transactions) - (total gold stock value)
      const cashBalance = Number(transactionsTotal.total || 0) - Number(totalGoldStockValueResult.total || 0);

      const adminStockAmount = Number(adminStock?.total || 0);
      const userHoldingsAmount = Number(userHoldings?.total || 0);
      const availableStock = adminStockAmount - userHoldingsAmount;

      // Operation successful
      
      // Trigger real-time update for the savings summary
      await pusherServer.trigger('gold-transactions', 'exchange', {
        message: 'Gold exchange completed',
        timestamp: new Date().toISOString(),
      });

      // Send Telegram notification
      await sendGoldPurchaseNotification({
        userName: `${user.name || user.email} (แลกทองรูปพรรณ ${jewelryName} จาก ${customer.name || customer.email})`,
        goldType,
        amount: goldAmount,
        totalPrice: goldAmount * Number(purchasePrice),
        pricePerUnit: Number(purchasePrice),
        remainingAmount: availableStock,
        totalUserBalance: cashBalance // Use the calculated cash balance
      });
    } catch (txError) {
      console.error('Transaction error:', txError);
      throw txError;
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Gold exchanged successfully from jewelry to customer',
      exchangeAmount: goldAmount,
      goldType,
    });
  } catch (error) {
    console.error('Error exchanging gold jewelry:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to exchange gold' },
      { status: 500 }
    );
  }
}