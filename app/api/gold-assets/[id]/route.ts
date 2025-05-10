import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { goldAssets, users, userBalances } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq, and, sql, ne } from 'drizzle-orm';
import { sendGoldPurchaseNotification } from '@/lib/telegram/bot';

const ADMIN_EMAIL = 'adminfortest@gmail.com';
const GOLD_TYPE = 'ทองสมาคม 96.5%';

export async function GET(request: NextRequest) {
  // Extract ID from URL path
  const id = parseInt(request.url.split('/').pop() || '0');
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ID already parsed from URL
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Get the gold asset
    const [asset] = await db
      .select()
      .from(goldAssets)
      .where(eq(goldAssets.id, id))
      .limit(1);

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Error fetching gold asset:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gold asset' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // Extract ID from URL path
  const id = parseInt(request.url.split('/').pop() || '0');
  try {
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ID already parsed from URL
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    const data = await request.json();
    const { goldType, amount, purchasePrice } = data;

    // Get the original asset before update
    const [originalAsset] = await db
      .select()
      .from(goldAssets)
      .where(eq(goldAssets.id, id))
      .limit(1);

    if (!originalAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Update the gold asset
    const [updatedAsset] = await db
      .update(goldAssets)
      .set({
        goldType,
        amount,
        purchasePrice,
        updatedAt: new Date(),
      })
      .where(eq(goldAssets.id, id))
      .returning();

    // Calculate admin's total stock after update
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

    // Send Telegram notification for the edit
    await sendGoldPurchaseNotification({
      userName: user.name || user.email,
      goldType,
      amount: Number(amount),
      totalPrice: Number(amount) * Number(purchasePrice),
      pricePerUnit: Number(purchasePrice),
      remainingAmount: availableStock,
      totalUserBalance: Number(totalUserBalance.total || 0)
    });

    return NextResponse.json({ success: true, asset: updatedAsset });
  } catch (error) {
    console.error('Error updating gold asset:', error);
    return NextResponse.json(
      { error: 'Failed to update gold asset' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Extract ID from URL path
  const id = parseInt(request.url.split('/').pop() || '0');
  try {
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ID already parsed from URL
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Get the asset before deleting it
    const [assetToDelete] = await db
      .select()
      .from(goldAssets)
      .where(eq(goldAssets.id, id))
      .limit(1);

    if (!assetToDelete) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Delete the gold asset
    const deleted = await db
      .delete(goldAssets)
      .where(eq(goldAssets.id, id))
      .returning();

    // Calculate admin's total stock after deletion
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

    // Send Telegram notification for the deletion
    await sendGoldPurchaseNotification({
      userName: user.name || user.email,
      goldType: assetToDelete.goldType,
      amount: -Number(assetToDelete.amount), // Negative to indicate removal
      totalPrice: -Number(assetToDelete.amount) * Number(assetToDelete.purchasePrice),
      pricePerUnit: Number(assetToDelete.purchasePrice),
      remainingAmount: availableStock, // Correct remaining amount after deletion
      totalUserBalance: Number(totalUserBalance.total || 0)
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting gold asset:', error);
    return NextResponse.json(
      { error: 'Failed to delete gold asset' },
      { status: 500 }
    );
  }
}