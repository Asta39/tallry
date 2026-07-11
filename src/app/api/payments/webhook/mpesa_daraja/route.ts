import { db, paymentEvents, paymentGateways, documents } from "@/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getGateway } from "@/lib/payments/gateway";
import { matchPayment } from "@/lib/payments/match";
import { recordPayment } from "@/lib/actions";
import { sendPaymentReceipt } from "@/lib/email/receipts";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const orgIdStr = url.searchParams.get("orgId");
    if (!orgIdStr) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    
    const orgId = parseInt(orgIdStr, 10);
    
    const [gatewayConfig] = await db
      .select()
      .from(paymentGateways)
      .where(
        and(
          eq(paymentGateways.orgId, orgId),
          eq(paymentGateways.gatewayId, "mpesa_daraja")
        )
      );
      
    if (!gatewayConfig || !gatewayConfig.enabled) {
      return NextResponse.json({ error: "Gateway not configured or disabled" }, { status: 400 });
    }

    const gateway = getGateway({
      gatewayId: gatewayConfig.gatewayId,
      configJson: gatewayConfig.configJson,
      environment: gatewayConfig.environment,
    });

    const inbound = await gateway.parseInbound(req, null);
    
    if (!inbound) {
      // Unrecognized format or failed payment, Safaricom requires a 200 OK anyway
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });
    }

    // See if we already processed this providerRef (idempotency)
    const existing = await db.select().from(paymentEvents).where(eq(paymentEvents.providerRef, inbound.providerRef));
    if (existing.length > 0) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });
    }

    // Match payment
    const matchedInvoiceId = await matchPayment(orgId, inbound);
    
    let status = "received";
    let paymentId = null;

    if (matchedInvoiceId) {
      status = "applied";
      // Apply payment to invoice
      const paymentId = await recordPayment({
        documentId: matchedInvoiceId,
        amountCents: inbound.amountCents,
        method: "mpesa",
        reference: inbound.providerRef,
        date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
        direction: "in",
      });
      if (paymentId) {
        await sendPaymentReceipt(paymentId).catch(e => console.error("Receipt failed:", e));
      }
    } else {
      status = "unmatched";
    }

    await db.insert(paymentEvents).values({
      orgId,
      gatewayId: "mpesa_daraja",
      providerRef: inbound.providerRef,
      amountCents: inbound.amountCents,
      payerPhone: inbound.payerPhone,
      payerName: inbound.payerName,
      accountRef: inbound.accountRef,
      status,
      matchedDocumentId: matchedInvoiceId,
      rawJson: JSON.stringify(inbound.raw),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });

  } catch (err: any) {
    console.error("M-Pesa Webhook Error:", err);
    // Even on error, send 200 OK to Daraja so it doesn't retry infinitely
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Error processed safely" });
  }
}
