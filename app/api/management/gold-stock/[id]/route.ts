import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { goldAssets } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';
import { sendGoldStockCutNotification } from '@/lib/telegram/bot';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const id = parseInt((await params).id);
    const { amount, purchasePrice } = await request.json();

    // Get current asset before update
    const [currentAsset] = await db
      .select()
      .from(goldAssets)
      .where(eq(goldAssets.id, id))
      .limit(1);

    if (!currentAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Update the gold asset
    const [updatedAsset] = await db
      .update(goldAssets)
      .set({
        amount: amount.toString(),
        purchasePrice: purchasePrice.toString(),
        updatedAt: new Date(),
      })
      .where(eq(goldAssets.id, id))
      .returning();

    // Send Telegram notification for stock cut if amount was reduced
    if (Number(amount) < Number(currentAsset.amount)) {
      const cutAmount = Number(currentAsset.amount) - Number(amount);
      try {
        await sendGoldStockCutNotification({
          adminName: user.name || user.email,
          goldType: currentAsset.goldType,
          amount: cutAmount,
          purchasePrice: Number(currentAsset.purchasePrice),
          remainingAmount: Number(amount)
        });
      } catch (notificationError) {
        console.error('Failed to send Telegram notification:', notificationError);
      }
    }

    return NextResponse.json({ success: true, asset: updatedAsset });
  } catch (error) {
    console.error('Error updating gold stock:', error);
    return NextResponse.json(
      { error: 'Failed to update gold stock' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const id = parseInt((await params).id);

    // Get asset before deletion for notification
    const [asset] = await db
      .select()
      .from(goldAssets)
      .where(eq(goldAssets.id, id))
      .limit(1);

    if (asset) {
      // Send notification about complete stock removal
      try {
        await sendGoldStockCutNotification({
          adminName: user.name || user.email,
          goldType: asset.goldType,
          amount: Number(asset.amount),
          purchasePrice: Number(asset.purchasePrice),
          remainingAmount: 0
        });
      } catch (notificationError) {
        console.error('Failed to send Telegram notification:', notificationError);
      }
    }

    await db
      .delete(goldAssets)
      .where(eq(goldAssets.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting gold stock:', error);
    return NextResponse.json(
      { error: 'Failed to delete gold stock' },
      { status: 500 }
    );
  }
}