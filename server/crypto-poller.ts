import { db } from "./db.js";
import { cryptoPayments } from "../shared/schema.js";
import { eq, and, inArray, isNull, or } from "drizzle-orm";
import { getNowPaymentsInvoice, mapNowPaymentsStatus } from "./nowpayments.js";
import { settleCryptoPayment } from "./crypto-settlement.js";
import { storage } from "./storage.js";
import { log } from "./logger.js";

export async function pollPendingCryptoPayments() {
  if (!process.env.NOWPAYMENTS_API_KEY) return;

  try {
    const pending = await db
      .select()
      .from(cryptoPayments)
      .where(or(
        inArray(cryptoPayments.status, ["pending", "underpaid"]),
        and(eq(cryptoPayments.status, "completed"), isNull(cryptoPayments.settledAt)),
      ));

    if (pending.length === 0) return;

    for (const payment of pending) {
      try {
        const invoice = await getNowPaymentsInvoice(payment.forebitPaymentId);
        const newStatus = mapNowPaymentsStatus(invoice.payment_status || invoice.status || "");

        if (newStatus === payment.status && !(payment.status === "completed" && !payment.settledAt)) continue;

        const [updated] = await db
          .update(cryptoPayments)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(and(eq(cryptoPayments.id, payment.id), eq(cryptoPayments.status, payment.status)))
          .returning();

        if (!updated && payment.status !== "completed") continue;

        if (newStatus === "completed" || payment.status === "completed") {
          await settleCryptoPayment(payment.id);
          log(`Auto-credited crypto payment ${payment.forebitPaymentId} ($${(payment.amount / 100).toFixed(2)}) for user ${payment.userId}`);
        } else if ((newStatus === "failed" || newStatus === "expired") && payment.purpose === "order" && payment.orderId) {
          await storage.cancelPendingOrder(payment.orderId);
          log(`Auto-cancelled order for failed crypto payment ${payment.forebitPaymentId}`);
        }
      } catch {
        // Skip individual errors silently
      }
    }
  } catch (err: any) {
    console.error("Crypto poller error:", err.message);
  }
}
