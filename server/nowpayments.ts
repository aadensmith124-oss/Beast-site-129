const NOWPAYMENTS_API_BASE = "https://api.nowpayments.io/v1";
import { createHmac, timingSafeEqual } from "crypto";

function getApiKey(): string {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) throw new Error("NOWPAYMENTS_API_KEY is not configured");
  return key;
}

export interface NowPaymentsInvoice {
  id: string;
  url: string;
  status?: string;
  price_amount?: number;
  price_currency?: string;
  [key: string]: any;
}

export async function createNowPaymentsInvoice(params: {
  amount: number;       // in USD
  orderId?: string;
  successUrl?: string;
  cancelUrl?: string;
  ipnCallbackUrl?: string;
}): Promise<NowPaymentsInvoice> {
  const apiKey = getApiKey();

  const body: Record<string, any> = {
    price_amount: params.amount,
    price_currency: "usd",
    order_id: params.orderId || `order-${Date.now()}`,
    order_description: "TurtleCC deposit",
  };

  if (params.successUrl)     body.success_url     = params.successUrl;
  if (params.cancelUrl)      body.cancel_url      = params.cancelUrl;
  if (params.ipnCallbackUrl) body.ipn_callback_url = params.ipnCallbackUrl;

  const response = await fetch(`${NOWPAYMENTS_API_BASE}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("NOWPayments API error:", response.status, errorText);
    throw new Error(`NOWPayments API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("NOWPayments create invoice response:", JSON.stringify(data, null, 2));

  const invoiceId = String(data.id);
  const invoiceUrl = data.invoice_url || data.url || "";

  if (!invoiceId) throw new Error("NOWPayments returned no invoice ID");
  if (!invoiceUrl) throw new Error("NOWPayments returned no invoice URL");

  return { ...data, id: invoiceId, url: invoiceUrl };
}

export async function getNowPaymentsInvoice(invoiceId: string): Promise<NowPaymentsInvoice> {
  const apiKey = getApiKey();

  const response = await fetch(`${NOWPAYMENTS_API_BASE}/invoice/${invoiceId}`, {
    method: "GET",
    headers: { "x-api-key": apiKey },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NOWPayments API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log("NOWPayments get invoice response:", JSON.stringify(data, null, 2));
  return data;
}

/** Verify the IPN webhook signature (HMAC-SHA512 of sorted JSON body) */
export function verifyNowPaymentsWebhook(body: Record<string, any>, signature: string): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return false; // Fail closed — require secret to be configured

  try {
    const sorted = JSON.stringify(
      Object.keys(body).sort().reduce((acc: Record<string, any>, k) => { acc[k] = body[k]; return acc; }, {})
    );
    const expected = createHmac("sha512", secret).update(sorted).digest("hex");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");
    return expectedBuffer.length === signatureBuffer.length
      && timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

export function mapNowPaymentsStatus(status: string): "pending" | "completed" | "failed" | "expired" | "underpaid" {
  switch ((status || "").toLowerCase()) {
    case "finished":                             return "completed";
    case "partially_paid":                       return "underpaid";
    case "failed": case "refunded":              return "failed";
    case "expired":                              return "expired";
    // waiting, confirming, confirmed, sending → pending
    default:                                     return "pending";
  }
}
