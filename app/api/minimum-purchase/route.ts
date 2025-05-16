import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { minimumPurchaseSettings } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    // Get current minimum purchase setting
    const settings = await db
      .select()
      .from(minimumPurchaseSettings)
      .orderBy(minimumPurchaseSettings.id)
      .limit(1);

    const data = settings[0] || {
      minimumAmount: '0'
    };

    return NextResponse.json({
      minimumAmount: data.minimumAmount
    });
  } catch (error) {
    console.error('Error fetching minimum purchase setting:', error);
    return NextResponse.json(
      { error: 'Failed to fetch minimum purchase setting' },
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

    const data = await request.json();
    
    // Validate the data
    const { minimumAmount } = data;
    
    if (typeof minimumAmount !== 'number' && typeof minimumAmount !== 'string') {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      );
    }
    
    const settings = await db
      .select()
      .from(minimumPurchaseSettings)
      .limit(1);

    if (settings.length === 0) {
      // Insert new setting
      await db.insert(minimumPurchaseSettings).values({
        minimumAmount: minimumAmount.toString(),
        updatedBy: user.id,
      });
    } else {
      // Update existing setting
      await db
        .update(minimumPurchaseSettings)
        .set({
          minimumAmount: minimumAmount.toString(),
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(eq(minimumPurchaseSettings.id, settings[0].id));
    }

    return NextResponse.json({
      success: true,
      minimumAmount
    });
  } catch (error) {
    console.error('Error updating minimum purchase setting:', error);
    return NextResponse.json(
      { error: 'Failed to update minimum purchase setting' },
      { status: 500 }
    );
  }
}