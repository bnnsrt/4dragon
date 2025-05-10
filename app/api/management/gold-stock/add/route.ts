import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { goldAssets } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { sendGoldPurchaseNotification } from '@/lib/telegram/bot';

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

    // Send Telegram notification
    await sendGoldPurchaseNotification({
      userName: user.name || user.email,
      goldType,
      amount: Number(amount),
      totalPrice: Number(amount) * Number(purchasePrice),
      pricePerUnit: Number(purchasePrice),
      remainingAmount: Number(amount),
      totalUserBalance: 0 // Not relevant for stock addition
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