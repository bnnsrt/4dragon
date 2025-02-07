import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { goldAssets } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';

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
    const { amount, purchasePrice } = await request.json();

    await db
      .update(goldAssets)
      .set({
        amount,
        purchasePrice,
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