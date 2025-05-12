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
    const { customerId, goldType, amount } = body;

    // Validate input
    if (!customerId || !goldType || !amount) {
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
      // Check if admin has enough gold stock
      const adminGoldAssetsList = await db.query.goldAssets.findMany({
        where: (assets, { eq, and }) => and(
          eq(assets.userId, user.id),
          eq(assets.goldType, goldType)
        )
      });

      const totalAdminGold = adminGoldAssetsList.reduce(
        (sum, asset) => sum + Number(asset.amount),
        0
      );

      if (totalAdminGold < goldAmount) {
        throw new Error('Insufficient gold stock');
      }

      // Create a record of the exchange transaction
      await db.insert(transactions).values({
        userId: customerId_num,
        type: 'EXCHANGE',
        amount: goldAmount.toString(),
        goldType,
        pricePerUnit: '0', // Exchange doesn't have a price per unit
        totalPrice: '0', // Exchange doesn't have a total price
      });

      // For exchange transactions, the admin is taking gold FROM the customer
      // So we need to DECREASE the customer's gold amount
      
      // First, check if the customer has enough gold to exchange
      const customerGoldAssets = await db.query.goldAssets.findMany({
        where: (assets, { eq, and }) => and(
          eq(assets.userId, customerId_num),
          eq(assets.goldType, goldType)
        )
      });
      
      const totalCustomerGold = customerGoldAssets.reduce(
        (sum, asset) => sum + Number(asset.amount),
        0
      );
      
      if (totalCustomerGold < goldAmount) {
        throw new Error(`Customer does not have enough gold. Available: ${totalCustomerGold} บาท, Requested: ${goldAmount} บาท`);
      }
      
      // Deduct gold from customer's account (FIFO method)
      let remainingToDeductFromCustomer = goldAmount;
      
      for (const asset of customerGoldAssets) {
        const assetAmount = Number(asset.amount);
        
        if (remainingToDeductFromCustomer <= 0) break;
        
        if (assetAmount <= remainingToDeductFromCustomer) {
          // Use up this entire asset
          await db.delete(goldAssets).where(eq(goldAssets.id, asset.id));
          remainingToDeductFromCustomer -= assetAmount;
        } else {
          // Use part of this asset
          await db.update(goldAssets)
            .set({ amount: (assetAmount - remainingToDeductFromCustomer).toString() })
            .where(eq(goldAssets.id, asset.id));
          remainingToDeductFromCustomer = 0;
        }
      }

      // Add gold to admin's stock
      // Use average purchase price from customer's gold that was deducted
      const avgPurchasePrice = customerGoldAssets.length > 0 ?
        customerGoldAssets.reduce((sum, asset) => sum + Number(asset.purchasePrice), 0) / customerGoldAssets.length :
        '30000'; // Default if no customer assets found
      
      await db.insert(goldAssets).values({
        userId: user.id,
        goldType,
        amount: goldAmount.toString(),
        purchasePrice: avgPurchasePrice.toString(),
      });

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
        userName: `${user.name || user.email} (exchanged from ${customer.name || customer.email})`,
        goldType,
        amount: goldAmount,
        totalPrice: goldAmount * Number(avgPurchasePrice),
        pricePerUnit: Number(avgPurchasePrice),
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
      message: 'Gold exchanged successfully from customer to admin',
      exchangeAmount: goldAmount,
      goldType,
    });
  } catch (error) {
    console.error('Error exchanging gold:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to exchange gold' },
      { status: 500 }
    );
  }
}