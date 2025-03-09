import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { paymentTransactions } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

const QR_API_URL = process.env.QR_API_URL;
const QR_API_SECRET = process.env.QR_API_SECRET;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ txnId: string }> }
) {
  try {
    const currentUser = await getUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { txnId } = await params;

    // Check if transaction exists and is within 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const transaction = await db.query.paymentTransactions.findFirst({
      where: and(
        eq(paymentTransactions.txnId, txnId),
        eq(paymentTransactions.userId, currentUser.id),
        eq(paymentTransactions.status, 'PE'),
        eq(paymentTransactions.method, 'QR'),
        gt(paymentTransactions.createdAt, fifteenMinutesAgo)
      ),
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'รายการไม่ถูกต้องหรือหมดอายุแล้ว' },
        { status: 404 }
      );
    }

    // Cancel QR payment with external API
    const response = await fetch(`${QR_API_URL}/payment/cancel/${txnId}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': QR_API_SECRET || '',
      },
    });

    const result = await response.json();
    
    if (!result.status) {
      throw new Error('Failed to cancel QR payment');
    }

    // Update transaction status to cancelled
    await db.update(paymentTransactions)
      .set({
        status: 'CANCELLED',
        statusName: 'ยกเลิกรายการ',
        updatedAt: new Date(),
      })
      .where(eq(paymentTransactions.txnId, txnId));

    return NextResponse.json({ status: true });
  } catch (error) {
    console.error('Error cancelling QR payment:', error);
    return NextResponse.json(
      { error: 'Failed to cancel QR payment' },
      { status: 500 }
    );
  }
}
