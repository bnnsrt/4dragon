import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { transactions, users } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';
import { eq, desc, or, inArray } from 'drizzle-orm';

export async function GET(request: Request) {
  // Parse query parameters
  const url = new URL(request.url);
  const includeAll = url.searchParams.get('includeAll') === 'true';
  try {
    const currentUser = await getUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // If admin, fetch all transactions with user details
    if (currentUser.role === 'admin') {
      // Define transaction types to include
      const transactionTypes = ['buy', 'sell', 'EXCHANGE', 'EX_JEWELRY'];
      
      // Build the query with conditional where clause
      const allTransactions = await db
        .select({
          id: transactions.id,
          goldType: transactions.goldType,
          amount: transactions.amount,
          pricePerUnit: transactions.pricePerUnit,
          totalPrice: transactions.totalPrice,
          type: transactions.type,
          createdAt: transactions.createdAt,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(transactions)
        .leftJoin(users, eq(transactions.userId, users.id))
        .where(includeAll ? undefined : inArray(transactions.type, transactionTypes))
        .orderBy(desc(transactions.createdAt));

      return NextResponse.json(allTransactions);
    }

    // For regular users, fetch only their transactions
    const userTransactions = await db
      .select({
        id: transactions.id,
        goldType: transactions.goldType,
        amount: transactions.amount,
        pricePerUnit: transactions.pricePerUnit,
        totalPrice: transactions.totalPrice,
        type: transactions.type,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(eq(transactions.userId, currentUser.id))
      .orderBy(desc(transactions.createdAt));

    return NextResponse.json(userTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}