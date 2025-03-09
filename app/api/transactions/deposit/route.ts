import { NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { paymentTransactions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getUser } from "@/lib/db/queries";

export async function GET() {
  try {
    const currentUser = await getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transactions = await db
      .select({
        id: paymentTransactions.id,
        amount: paymentTransactions.total,
        createdAt: paymentTransactions.createdAt,
        status: paymentTransactions.status,
      })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.userId, currentUser.id))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(50);

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching deposit transactions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
