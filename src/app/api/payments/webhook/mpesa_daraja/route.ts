import { NextResponse } from "next/server";
import { handleGatewayWebhook } from "@/lib/payments/webhook";

export async function POST(req: Request) {
  try {
    const outcome = await handleGatewayWebhook(req, "mpesa_daraja");

    if (outcome.kind === "rejected") {
      // Forged or misconfigured request — do NOT ack with success.
      return NextResponse.json({ error: outcome.reason }, { status: 401 });
    }

    // Genuine Daraja deliveries (ignored/duplicate/processed) get the 200 ack
    // Safaricom expects so it stops retrying.
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });
  } catch (err: any) {
    console.error("M-Pesa Webhook Error:", err);
    // Transient failure (e.g. DB down): return 500 so Daraja retries.
    // Idempotency in the handler makes the retry safe.
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
