import { and, eq, sql } from "drizzle-orm";
import { cryptoPayments, transactions, users } from "../shared/schema.js";
import { db } from "./db.js";
import { storage } from "./storage.js";

/**
 * Settles a completed NOWPayments invoice exactly once.
 *
 * IPNs, the background poller, and the client status endpoint can all observe
 * the same blockchain payment. The row lock plus the payment-specific
 * transaction description makes retries safe.
 */
export async function settleCryptoPayment(paymentId: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(cryptoPayments)
      .where(eq(cryptoPayments.id, paymentId))
      .for("update");

    if (!payment || payment.status !== "completed" || payment.settledAt) {
      return false;
    }

    const description = payment.purpose === "order"
      ? `Crypto order payment (${(payment.amount / 100).toFixed(2)}) [${payment.forebitPaymentId}]`
      : `Crypto deposit (${(payment.amount / 100).toFixed(2)}) [${payment.forebitPaymentId}]`;

    const [existingTransaction] = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(
        eq(transactions.userId, payment.userId),
        eq(transactions.description, description),
      ))
      .limit(1);

    if (!existingTransaction) {
      if (payment.purpose === "order" && payment.orderId) {
        await storage.fulfillPendingOrder(payment.orderId);
        await tx.insert(transactions).values({
          userId: payment.userId,
          amount: -payment.amount,
          type: "purchase",
          description,
          paymentMethod: "NOWPayments",
          orderId: payment.orderId,
        });
      } else {
        await tx
          .update(users)
          .set({
            balance: sql`${users.balance} + ${payment.amount}`,
            protectedBalance: sql`${users.protectedBalance} + ${payment.amount}`,
          })
          .where(eq(users.id, payment.userId));

        await tx.insert(transactions).values({
          userId: payment.userId,
          amount: payment.amount,
          type: "deposit",
          description,
          paymentMethod: "NOWPayments",
        });
      }
    }

    await tx
      .update(cryptoPayments)
      .set({ settledAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(cryptoPayments.id, payment.id),
        eq(cryptoPayments.status, "completed"),
      ));

    return true;
  });
}