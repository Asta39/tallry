/**
 * IntaSend client for Zeno's OWN subscription billing (platform-level, not
 * per-org like the Daraja/KopoKopo tenant gateways). Collects plan payments
 * via M-Pesa STK push.
 *
 * Env:
 *   INTASEND_SECRET_KEY   — Bearer token for API calls (required)
 *   INTASEND_TEST_MODE    — "true" → sandbox.intasend.com, else api.intasend.com
 */

function baseUrl(): string {
  return process.env.INTASEND_TEST_MODE === "true"
    ? "https://sandbox.intasend.com"
    : "https://api.intasend.com";
}

function authHeaders(): Record<string, string> {
  const key = process.env.INTASEND_SECRET_KEY;
  if (!key) throw new Error("INTASEND_SECRET_KEY is not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

/** Normalize a Kenyan phone number to 254XXXXXXXXX. Throws on garbage. */
export function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/[^\d]/g, "");
  let msisdn = digits;
  if (digits.startsWith("0")) msisdn = "254" + digits.slice(1);
  else if (digits.startsWith("7") || digits.startsWith("1")) msisdn = "254" + digits;
  if (!/^254(7|1)\d{8}$/.test(msisdn)) {
    throw new Error("Enter a valid Safaricom number, e.g. 0712 345 678");
  }
  return msisdn;
}

export interface StkPushResult {
  invoiceId: string;
  state: string;
}

/** Trigger an M-Pesa STK push. amountKes is whole shillings (IntaSend takes KES units, not cents). */
export async function intasendStkPush(params: {
  amountKes: number;
  phone: string; // 254XXXXXXXXX
  apiRef: string;
  narrative?: string;
}): Promise<StkPushResult> {
  const res = await fetch(`${baseUrl()}/api/v1/payment/mpesa-stk-push/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      amount: String(params.amountKes),
      phone_number: params.phone,
      api_ref: params.apiRef,
      narrative: params.narrative || "Zeno subscription",
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body?.detail || body?.errors?.[0]?.detail || JSON.stringify(body);
    throw new Error(`IntaSend STK push failed (${res.status}): ${detail}`);
  }
  const invoiceId = body?.invoice?.invoice_id;
  if (!invoiceId) throw new Error("IntaSend response missing invoice_id");
  return { invoiceId, state: body?.invoice?.state || "PENDING" };
}

export interface PaymentStatus {
  state: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED" | string;
  failedReason: string | null;
  netAmount: string | null;
}

/** Poll the status of an STK push by IntaSend invoice id. */
export async function intasendStatus(invoiceId: string): Promise<PaymentStatus> {
  const res = await fetch(`${baseUrl()}/api/v1/payment/status/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`IntaSend status check failed (${res.status})`);
  }
  return {
    state: body?.invoice?.state || "PENDING",
    failedReason: body?.invoice?.failed_reason || null,
    netAmount: body?.invoice?.net_amount != null ? String(body.invoice.net_amount) : null,
  };
}
