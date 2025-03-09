import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { paymentTransactions, userBalances } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getUser } from '@/lib/db/queries';

const QR_API_URL = process.env.QR_API_URL;
const QR_API_SECRET = process.env.QR_API_SECRET;

export async function GET(
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

    // Get transaction from database
    const [transaction] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.txnId, txnId))
      .limit(1);

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check payment status with external API
    const response = await fetch(`${QR_API_URL}/payment/${txnId}`, {
      headers: {
        'x-api-key': QR_API_SECRET || '',
      },
    });

    const result = await response.json();
    if (!result.status) {
      throw new Error('Failed to check payment status');
    }

    // Return current status if not success or already completed
    return NextResponse.json({
      status: true,
      data: {
        status: result.data.status,
        message: result.data.status === 'PENDING' ? 'รอการชำระเงิน' : 'ชำระเงินไม่สำเร็จ',
        transactionId: transaction.id,
        amount: parseFloat(result.data.amount),
      },
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return NextResponse.json(
      { error: 'Failed to check payment status' },
      { status: 500 }
    );
  }
}
