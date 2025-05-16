import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { transactions, users } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher';

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const { params } = context;
  try {
    const currentUser = await getUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const transactionId = parseInt(params.id);
    
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

    // Delete the transaction
    await db.delete(transactions).where(eq(transactions.id, transactionId));

    // Trigger real-time update
    await pusherServer.trigger('gold-transactions', 'transaction-deleted', {
      message: 'Transaction deleted',
      transactionId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Transaction deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: { params: { id: string } }) {
  const { params } = context;
  try {
    const currentUser = await getUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const transactionId = parseInt(params.id);
    
    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    // Get the transaction to verify it exists
    const existingTransaction = await db.query.transactions.findFirst({
      where: (transactions, { eq }) => eq(transactions.id, transactionId)
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { customerId, goldType, amount, type } = body;

    // Validate input
    if (!customerId || !goldType || !amount || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update the transaction
    await db
      .update(transactions)
      .set({
        userId: parseInt(customerId),
        goldType,
        amount,
        type
      })
      .where(eq(transactions.id, transactionId));

    // Trigger real-time update
    await pusherServer.trigger('gold-transactions', 'transaction-updated', {
      message: 'Transaction updated',
      transactionId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Transaction updated successfully',
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}
