import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { transactions, users, goldAssets } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq, and } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher';

export async function POST(request: NextRequest) {
  // Extract ID from URL path
  const id = request.url.split('/').slice(-2)[0];
  try {
    const currentUser = await getUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const transactionId = parseInt(id);
    
    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Get the transaction to verify it exists and is a jewelry exchange transaction
    const transaction = await db.query.transactions.findFirst({
      where: (transactions, { eq }) => eq(transactions.id, transactionId)
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // For jewelry exchange transactions, we mark them as canceled
    // by updating the type to "CANCEL_EX" (must be 10 chars or less for varchar(10))
    if (transaction.type === 'EX_JEWELRY') {
      await db
        .update(transactions)
        .set({
          type: 'CANCEL_EX'
        })
        .where(eq(transactions.id, transactionId));
      
      // Important: Return gold to the customer when canceling
      // First, find the customer's existing gold asset
      const customerGoldAsset = await db.query.goldAssets.findFirst({
        where: (assets, { eq, and }) => and(
          eq(assets.userId, transaction.userId),
          eq(assets.goldType, 'ทองสมาคม 96.5%')
        )
      });
      
      if (customerGoldAsset) {
        // Update existing asset with increased amount
        const newAmount = Number(customerGoldAsset.amount) + Number(transaction.amount);
        await db
          .update(goldAssets)
          .set({
            amount: newAmount.toString()
          })
          .where(eq(goldAssets.id, customerGoldAsset.id));
      } else {
        // Create new asset if customer doesn't have this gold type
        await db.insert(goldAssets).values({
          userId: transaction.userId,
          goldType: 'ทองสมาคม 96.5%',
          amount: transaction.amount,
          purchasePrice: '0', // Default price since we don't know the original purchase price
        });
      }
    } else {
      return NextResponse.json(
        { error: 'Only jewelry exchange transactions can be canceled' },
        { status: 400 }
      );
    }

    // Trigger real-time update
    await pusherServer.trigger('gold-transactions', 'transaction-canceled', {
      message: 'Transaction canceled',
      transactionId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Transaction canceled successfully',
    });
  } catch (error) {
    console.error('Error canceling transaction:', error);
    return NextResponse.json(
      { error: 'Failed to cancel transaction' },
      { status: 500 }
    );
  }
}
