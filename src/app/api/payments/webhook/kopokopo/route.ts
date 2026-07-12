import { NextResponse } from "next/server";
import { handleGatewayWebhook } from "@/lib/payments/webhook";

export async function POST(req: Request) {
  try {
    const outcome = await handleGatewayWebhook(req, "kopokopo");

    if (outcome.kind === "rejected") {
      return NextResponse.json({ error: outcome.reason }, { status: 401 });
    }

    return NextResponse.json({ status: outcome.kind === "processed" ? outcome.status : outcome.kind });
  } catch (err: any) {
    console.error("Kopo Kopo Webhook Error:", err);
    // 500 so Kopo Kopo retries; idempotency makes the retry safe.
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
