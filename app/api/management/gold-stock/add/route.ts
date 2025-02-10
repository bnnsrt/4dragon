import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { goldAssets } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { sendGoldStockNotification } from '@/lib/telegram/bot';

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
    await db.insert(goldAssets).values({
      userId: user.id,
      goldType,
      amount,
      purchasePrice,
    });

    // Send Telegram notification without throwing errors
    try {
      await sendGoldStockNotification({
        adminName: user.name || user.email,
        goldType,
        amount: Number(amount),
        purchasePrice: Number(purchasePrice)
      });
    } catch (notificationError) {
      // Just log notification errors without affecting the main flow
      console.error('Failed to send Telegram notification:', notificationError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding gold stock:', error);
    return NextResponse.json(
      { error: 'Failed to add gold stock' },
      { status: 500 }
    );
  }
}