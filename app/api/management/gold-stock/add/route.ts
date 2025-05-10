import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { goldAssets, users, userBalances } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { sendGoldPurchaseNotification } from '@/lib/telegram/bot';
import { eq, and, sql, ne } from 'drizzle-orm';

const ADMIN_EMAIL = 'adminfortest@gmail.com';
const GOLD_TYPE = 'ทองสมาคม 96.5%';

export async function POST(request: Request) {
  try {
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { goldType, amount, purchasePrice } = await request.json();

    // Create new gold asset record
    const [newAsset] = await db.insert(goldAssets).values({
      userId: user.id,
      goldType,
      amount,
      purchasePrice,
    }).returning();

    // Calculate admin's total stock
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

    const adminStockAmount = Number(adminStock?.total || 0);
    const userHoldingsAmount = Number(userHoldings?.total || 0);
    const availableStock = adminStockAmount - userHoldingsAmount;

    // Send Telegram notification
    await sendGoldPurchaseNotification({
      userName: user.name || user.email,
      goldType,
      amount: Number(amount),
      totalPrice: Number(amount) * Number(purchasePrice),
      pricePerUnit: Number(purchasePrice),
      remainingAmount: availableStock,
      totalUserBalance: Number(totalUserBalance.total || 0)
    });

    return NextResponse.json({ success: true, asset: newAsset });
  } catch (error) {
    console.error('Error adding gold stock:', error);
    return NextResponse.json(
      { error: 'Failed to add gold stock' },
      { status: 500 }
    );
  }
}