import { db, paymentEvents, paymentGateways } from "@/db";
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

    // ── Idempotency — check if already processed ──
    const existing = await db.select().from(paymentEvents)
      .where(
        and(
          eq(paymentEvents.providerRef, inbound.providerRef),
          eq(paymentEvents.status, "applied")
        )
      );
    if (existing.length > 0) {
      return NextResponse.json({ status: "already_processed" });
    }

    // ── Look for a pending STK push event we initiated ──
    // For Kopo Kopo, the pending event has providerRef = Location URL from 201 Created.
    // The callback has a different providerRef (the M-Pesa receipt number).
    // We match by accountRef (invoice number) + pending status + same org.
    let pendingEvent = null;
    if (inbound.accountRef) {
      const [found] = await db
        .select()
        .from(paymentEvents)
        .where(
          and(
            eq(paymentEvents.orgId, orgId),
            eq(paymentEvents.gatewayId, "kopokopo"),
            eq(paymentEvents.accountRef, inbound.accountRef),
            eq(paymentEvents.status, "pending")
          )
        );
      pendingEvent = found || null;
    }

    // ── Match to invoice ──
    let matchedInvoiceId: number | null = null;
    
    if (pendingEvent && pendingEvent.matchedDocumentId) {
      // Bulletproof match from our STK push
      matchedInvoiceId = pendingEvent.matchedDocumentId;
    } else {
      // Fuzzy match for organic payments
      matchedInvoiceId = await matchPayment(orgId, inbound);
    }

    // ── Apply payment ──
    let status = "unmatched";

    if (matchedInvoiceId) {
      status = "applied";
      const paymentId = await recordPayment({
        documentId: matchedInvoiceId,
        amountCents: inbound.amountCents,
        method: "kopokopo",
        reference: inbound.providerRef,
        date: new Date().toISOString().split("T")[0],
        direction: "in",
      });
      if (paymentId) {
        await sendPaymentReceipt(paymentId).catch(e => console.error("Receipt failed:", e));
      }
    }

    // ── Update or create payment event ──
    if (pendingEvent) {
      await db.update(paymentEvents)
        .set({
          providerRef: inbound.providerRef, // Replace Location URL with actual receipt
          amountCents: inbound.amountCents,
          payerPhone: inbound.payerPhone,
          payerName: inbound.payerName,
          status,
          rawJson: JSON.stringify(inbound.raw),
        })
        .where(eq(paymentEvents.id, pendingEvent.id));
    } else {
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
    }

    return NextResponse.json({ status: "success" });

  } catch (err: any) {
    console.error("Kopo Kopo Webhook Error:", err);
    return NextResponse.json({ status: "error" });
  }
}
