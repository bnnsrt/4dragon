import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { userBalances, goldAssets, transactions, users } from '@/lib/db/schema';
import { eq, sql, ne, and } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';
import { sendGoldPurchaseNotification } from '@/lib/telegram/bot';
import { isTradingAllowed } from '@/lib/utils';

const ADMIN_EMAIL = 'adminfortest@gmail.com';
const GOLD_TYPE = 'ทองสมาคม 96.5%';

export async function POST(request: Request) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check trading status
    const tradingStatus = isTradingAllowed();
    if (!tradingStatus.allowed) {
      return NextResponse.json(
        { error: tradingStatus.message },
        { status: 400 }
      );
    }

    const data = await request.json();
    const { goldType, amount, pricePerUnit, totalPrice } = data;

    // Start a transaction
    const result = await db.transaction(async (tx) => {
      // Update user balance
      await tx
        .update(userBalances)
        .set({
          balance: sql`${userBalances.balance} - ${totalPrice}`,
          updatedAt: new Date(),
        })
        .where(eq(userBalances.userId, user.id));

      // Create new gold asset record
      await tx.insert(goldAssets).values({
        userId: user.id,
        goldType,
        amount,
        purchasePrice: pricePerUnit,
      });

      // Record buy transaction
      await tx.insert(transactions).values({
        userId: user.id,
        goldType,
        amount,
        pricePerUnit,
        totalPrice,
        type: 'buy',
      });

      // Get updated balance
      const [newBalance] = await tx
        .select()
        .from(userBalances)
        .where(eq(userBalances.userId, user.id))
        .limit(1);

      // Calculate admin's remaining stock
      const [adminStock] = await tx
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
      const [userHoldings] = await tx
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
      const [transactionsTotal] = await tx
        .select({
          total: sql<string>`COALESCE(sum(CASE WHEN ${transactions.type} = 'buy' THEN ${transactions.totalPrice} ELSE 0 END), '0')`
        })
        .from(transactions);

      // Get total gold stock value (sum of all admin's gold assets)
      const [totalGoldStockValueResult] = await tx
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

      const adminStockAmount = Number(adminStock?.total || 0);
      const userHoldingsAmount = Number(userHoldings?.total || 0);
      const availableStock = adminStockAmount - userHoldingsAmount;

      // Calculate the cash balance as shown in the dashboard: sum of buy transactions
      const cashBalance = Number(transactionsTotal.total || 0);

      // Send Telegram notification with correct remaining amount and total balance
      await Promise.allSettled([
        sendGoldPurchaseNotification({
          userName: user.name || user.email,
          goldType,
          amount: Number(amount),
          totalPrice: Number(totalPrice),
          pricePerUnit: Number(pricePerUnit),
          remainingAmount: availableStock,
          totalUserBalance: cashBalance,
          totalGoldStockValue: Number(totalGoldStockValueResult.total || 0)
        })
      ]);

      return {
        balance: newBalance.balance,
        goldAmount: availableStock.toString()
      };
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error processing gold purchase:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process purchase' },
      { status: 500 }
    );
  }
}