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

    // Clone the request so we can read the body twice (once for CheckoutRequestID, once for parseInbound)
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    const callback = body?.Body?.stkCallback;
    if (!callback) {
      // Not a recognized callback format
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });
    }

    const checkoutRequestID = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;

    // ── Step 1: Check if this is a response to an STK push we initiated ──
    // We saved a pending event with providerRef = CheckoutRequestID when we sent the STK push.
    let pendingEvent = null;
    if (checkoutRequestID) {
      const [found] = await db
        .select()
        .from(paymentEvents)
        .where(
          and(
            eq(paymentEvents.orgId, orgId),
            eq(paymentEvents.providerRef, checkoutRequestID),
            eq(paymentEvents.status, "pending")
          )
        );
      pendingEvent = found || null;
    }

    // ── Step 2: Handle failed/cancelled payments ──
    if (resultCode !== 0) {
      // Payment was cancelled or failed by user
      if (pendingEvent) {
        await db.update(paymentEvents)
          .set({ status: "failed", rawJson: JSON.stringify(body) })
          .where(eq(paymentEvents.id, pendingEvent.id));
      }
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });
    }

    // ── Step 3: Extract payment details from successful callback ──
    const items = callback.CallbackMetadata?.Item || [];
    const getVal = (name: string) => items.find((i: any) => i.Name === name)?.Value;

    const amount = getVal("Amount");
    const mpesaReceiptNumber = getVal("MpesaReceiptNumber");
    const phoneNumber = getVal("PhoneNumber");

    if (!mpesaReceiptNumber) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });
    }

    // ── Step 4: Idempotency — check if we already processed this receipt number ──
    const existing = await db.select().from(paymentEvents)
      .where(
        and(
          eq(paymentEvents.providerRef, mpesaReceiptNumber),
          eq(paymentEvents.status, "applied")
        )
      );
    if (existing.length > 0) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });
    }

    const amountCents = Math.round(Number(amount) * 100);
    
    // ── Step 5: Match to invoice ──
    // Priority 1: If we have a pending event from our STK push, use its matchedDocumentId directly (bulletproof)
    // Priority 2: Fall back to the fuzzy matching logic (for organic payments not initiated by us)
    let matchedInvoiceId: number | null = null;
    
    if (pendingEvent && pendingEvent.matchedDocumentId) {
      // Bulletproof match — we know exactly which invoice this is for
      matchedInvoiceId = pendingEvent.matchedDocumentId;
    } else {
      // Fuzzy match for organic payments (customer paid via paybill directly)
      const inbound = {
        providerRef: mpesaReceiptNumber,
        amountCents,
        payerPhone: phoneNumber ? String(phoneNumber) : undefined,
        accountRef: getVal("AccountReference"),
        paidAt: new Date().toISOString(),
        raw: body,
      };
      matchedInvoiceId = await matchPayment(orgId, inbound);
    }

    // ── Step 6: Apply payment if matched ──
    let status = "unmatched";
    let paymentId = null;

    if (matchedInvoiceId) {
      status = "applied";
      paymentId = await recordPayment({
        documentId: matchedInvoiceId,
        amountCents,
        method: "mpesa",
        reference: mpesaReceiptNumber,
        date: new Date().toISOString().split("T")[0],
        direction: "in",
      });
      if (paymentId) {
        await sendPaymentReceipt(paymentId).catch(e => console.error("Receipt failed:", e));
      }
    }

    // ── Step 7: Update or create the payment event record ──
    if (pendingEvent) {
      // Update the pending event we created during STK push
      await db.update(paymentEvents)
        .set({
          providerRef: mpesaReceiptNumber, // Replace CheckoutRequestID with actual receipt
          amountCents,
          payerPhone: phoneNumber ? String(phoneNumber) : pendingEvent.payerPhone,
          status,
          rawJson: JSON.stringify(body),
        })
        .where(eq(paymentEvents.id, pendingEvent.id));
    } else {
      // This is an organic payment (not from our STK push), create a new event
      await db.insert(paymentEvents).values({
        orgId,
        gatewayId: "mpesa_daraja",
        providerRef: mpesaReceiptNumber,
        amountCents,
        payerPhone: phoneNumber ? String(phoneNumber) : undefined,
        accountRef: getVal("AccountReference"),
        status,
        matchedDocumentId: matchedInvoiceId,
        rawJson: JSON.stringify(body),
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" });

  } catch (err: any) {
    console.error("M-Pesa Webhook Error:", err);
    // Even on error, send 200 OK to Daraja so it doesn't retry infinitely
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Error processed safely" });
  }
}
