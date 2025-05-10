import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { goldAssets } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';
import { sendGoldPurchaseNotification } from '@/lib/telegram/bot';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Get the gold asset
    const asset = await db
      .select()
      .from(goldAssets)
      .where(eq(goldAssets.id, id))
      .limit(1);

    if (asset.length === 0) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(asset[0]);
  } catch (error) {
    console.error('Error fetching gold asset:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gold asset' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const id = parseInt(params.id);
    
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

    // Send Telegram notification for the edit
    await sendGoldPurchaseNotification({
      userName: user.name || user.email,
      goldType,
      amount: Number(amount),
      totalPrice: Number(amount) * Number(purchasePrice),
      pricePerUnit: Number(purchasePrice),
      remainingAmount: Number(amount),
      totalUserBalance: 0 // Not relevant for stock edit
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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const id = parseInt(params.id);
    
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
    await db
      .delete(goldAssets)
      .where(eq(goldAssets.id, id));

    // Send Telegram notification for the deletion
    await sendGoldPurchaseNotification({
      userName: user.name || user.email,
      goldType: assetToDelete.goldType,
      amount: -Number(assetToDelete.amount), // Negative to indicate removal
      totalPrice: -Number(assetToDelete.amount) * Number(assetToDelete.purchasePrice),
      pricePerUnit: Number(assetToDelete.purchasePrice),
      remainingAmount: 0, // Will be calculated after deletion
      totalUserBalance: 0 // Not relevant for stock deletion
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