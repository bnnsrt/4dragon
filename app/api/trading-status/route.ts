import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { tradingStatus } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const status = await db
      .select()
      .from(tradingStatus)
      .orderBy(tradingStatus.id)
      .limit(1);

    if (status.length === 0) {
      return NextResponse.json({
        isOpen: true,
        message: ''
      });
    }

    return NextResponse.json({
      isOpen: status[0].isOpen,
      message: status[0].message || '',
      updatedAt: status[0].updatedAt
    });
  } catch (error) {
    console.error('Error fetching trading status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trading status' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { isOpen, message } = await request.json();

    const status = await db
      .select()
      .from(tradingStatus)
      .limit(1);

    if (status.length === 0) {
      // Create initial status if it doesn't exist
      await db.insert(tradingStatus).values({
        isOpen: isOpen,
        message: message || '',
        updatedBy: user.id,
      });
    } else {
      // Update existing status
      await db
        .update(tradingStatus)
        .set({
          isOpen: isOpen,
          message: message || '',
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(eq(tradingStatus.id, status[0].id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating trading status:', error);
    return NextResponse.json(
      { error: 'Failed to update trading status' },
      { status: 500 }
    );
  }
}