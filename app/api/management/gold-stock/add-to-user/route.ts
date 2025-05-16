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
    const { customerId, goldType, amount, goldPrice } = body;

    // Validate input
    if (!customerId || !goldType || !amount || !goldPrice) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Convert amount and price to numbers and validate
    const goldAmount = Number(amount);
    const pricePerUnit = Number(goldPrice);
    
    if (isNaN(goldAmount) || goldAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid gold amount' },
        { status: 400 }
      );
    }

    if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
      return NextResponse.json(
        { error: 'Invalid gold price' },
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
    try {
      // Create a transaction record for the gold addition
      await db.insert(transactions).values({
        userId: customerId_num,
        type: 'buy',
        amount: goldAmount.toString(),
        goldType,
        pricePerUnit: pricePerUnit.toString(),
        totalPrice: (goldAmount * pricePerUnit).toString(),
      });

      // Add gold to customer's account
      await db.insert(goldAssets).values({
        userId: customerId_num,
        goldType,
        amount: goldAmount.toString(),
        purchasePrice: pricePerUnit.toString(),
      });

      // Calculate admin's total stock after addition
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

      // Trigger real-time update for the savings summary
      await pusherServer.trigger('gold-transactions', 'add-to-user', {
        message: 'Gold added to user',
        timestamp: new Date().toISOString(),
      });

      // Send Telegram notification
      await sendGoldPurchaseNotification({
        userName: customer.name || customer.email,
        goldType,
        amount: goldAmount,
        totalPrice: goldAmount * pricePerUnit,
        pricePerUnit: pricePerUnit,
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
      message: 'Gold added to user successfully',
      addedAmount: goldAmount,
      goldType,
    });
  } catch (error) {
    console.error('Error adding gold to user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add gold to user' },
      { status: 500 }
    );
  }
}
