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
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid asset ID' },
        { status: 400 }
      );
    }

    // Delete the gold asset
    await db
      .delete(goldAssets)
      .where(eq(goldAssets.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting gold asset:', error);
    return NextResponse.json(
      { error: 'Failed to delete gold asset' },
      { status: 500 }
    );
  }
}