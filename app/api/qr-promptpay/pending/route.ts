import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { paymentTransactions } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

const QR_API_URL = process.env.QR_API_URL;
const QR_API_SECRET = process.env.QR_API_SECRET;

export async function GET() {
  try {
    const currentUser = await getUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check for pending QR transactions within last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    const pendingTransaction = await db.query.paymentTransactions.findFirst({
      where: and(
        eq(paymentTransactions.userId, currentUser.id),
        eq(paymentTransactions.status, 'PE'),
        eq(paymentTransactions.method, 'QR'),
        gt(paymentTransactions.createdAt, fifteenMinutesAgo)
      ),
      orderBy: (transactions, { desc }) => [desc(transactions.createdAt)],
    });

    // console.log('Found pending transaction:', pendingTransaction);

    if (!pendingTransaction) {
      return NextResponse.json({ status: true, data: null });
    }

    // Get QR data from payment API
    const response = await fetch(`${QR_API_URL}/payment/${pendingTransaction.txnId}`, {
      headers: {
        'x-api-key': QR_API_SECRET || '',
      },
    });

    const result = await response.json();
    if (!result.status) {
      throw new Error('Failed to get payment data');
    }

    return NextResponse.json({
      status: true,
      data: {
        transactionId: pendingTransaction.id,
        txnId: pendingTransaction.txnId,
        qrImage: result.data.qr_image,
        amount: parseFloat(result.data.amount),
        promptpayNumber: result.data.promptpayNumber,
        createdAt: pendingTransaction.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error checking pending transaction:', error);
    return NextResponse.json(
      { error: 'Failed to check pending transaction' },
      { status: 500 }
    );
  }
}
