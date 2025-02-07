
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { goldAssets } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';

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

    // Update the gold asset
    await db
      .update(goldAssets)
      .set({
        amount: amount.toString(),
        purchasePrice: purchasePrice.toString(),
        updatedAt: new Date(),
      })
      .where(eq(goldAssets.id, id));

    return NextResponse.json({ success: true });
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