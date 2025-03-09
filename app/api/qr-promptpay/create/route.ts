import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { paymentTransactions } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq, and, gt } from 'drizzle-orm';

const QR_API_URL = process.env.QR_API_URL;
const QR_SITE_ID = process.env.QR_SITE_ID;
const QR_API_SECRET = process.env.QR_API_SECRET;

export async function POST(request: Request) {
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
    });

    if (pendingTransaction) {
      return NextResponse.json(
        { error: 'มีรายการ QR Payment ที่ยังไม่เสร็จสิ้นในช่วง 15 นาทีที่ผ่านมา กรุณารอให้รายการเดิมหมดอายุหรือยกเลิกรายการก่อนทำรายการใหม่' },
        { status: 400 }
      );
    }

    const { amount } = await request.json();

    // console.log("amount", { amount: parseInt(amount) });
    // console.log(`${QR_API_URL}/payment/${QR_SITE_ID}/bank/create`);
    // console.log("SECRET", QR_API_SECRET);
    
    

    // Create QR payment
    const response = await fetch(`${QR_API_URL}/payment/${QR_SITE_ID}/bank/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': QR_API_SECRET || '',
      },
      body: JSON.stringify({ amount: parseInt(amount) }),
    });

    const result = await response.json();

    const response_payment = await fetch(`${QR_API_URL}/payment/${result.data.txnId}`, {
        headers: {
          'x-api-key': QR_API_SECRET || '',
        },
      });
  
      const result_payment = await response_payment.json();
      if (!result_payment.status) {
        throw new Error('Failed to check payment status');
      }
    

    if (!result.status) {
      throw new Error(result.message || 'Failed to create QR payment');
    }

    // Generate unique order number
    const orderNo = `${currentUser.id}-${Date.now()}`;

    // Create payment transaction record
    const [transaction] = await db.insert(paymentTransactions)
      .values({
        userId: currentUser.id,
        total: amount.toString(),
        status: 'PE',
        statusName: 'รอการชำระเงิน',
        method: 'QR',
        txnId: result.data.txnId,
        merchantId: QR_SITE_ID || '',
        orderNo: orderNo,
        refNo: orderNo,
        productDetail: 'เติมเงินผ่าน QR PromptPay',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      status: true,
      data: {
        transactionId: transaction.id,
        txnId: result.data.txnId,
        qrImage: result_payment.data.qr_image,
        amount: parseFloat(result_payment.data.amount),
        promptpayNumber: result_payment.data.promptpayNumber,
        createdAt: transaction.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating QR payment:', error);
    return NextResponse.json(
      { error: 'Failed to create QR payment' },
      { status: 500 }
    );
  }
}