import { db, paymentEvents, paymentGateways } from "@/db";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getGateway } from "@/lib/payments/gateway";
import { matchPayment } from "@/lib/payments/match";
import { recordPayment } from "@/lib/actions";

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
          eq(paymentGateways.gatewayId, "kopokopo")
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
      return NextResponse.json({ status: "ignored" });
    }

    // Idempotency
    const existing = await db.select().from(paymentEvents).where(eq(paymentEvents.providerRef, inbound.providerRef));
    if (existing.length > 0) {
      return NextResponse.json({ status: "already_processed" });
    }

    const matchedInvoiceId = await matchPayment(orgId, inbound);
    
    let status = "received";

    if (matchedInvoiceId) {
      status = "applied";
      await recordPayment({
        documentId: matchedInvoiceId,
        amountCents: inbound.amountCents,
        method: "kopokopo",
        reference: inbound.providerRef,
        date: new Date().toISOString().split("T")[0],
        direction: "in",
      });
    } else {
      status = "unmatched";
    }

    await db.insert(paymentEvents).values({
      orgId,
      gatewayId: "kopokopo",
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

    return NextResponse.json({ status: "success" });

  } catch (err: any) {
    console.error("Kopo Kopo Webhook Error:", err);
    // Return 200 OK to Kopo Kopo so they don't block
    return NextResponse.json({ status: "error" });
  }
}
