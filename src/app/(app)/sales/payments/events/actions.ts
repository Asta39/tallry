"use server";

import { db, paymentEvents, documents } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { requirePerm } from "@/lib/guard";
import { getOrg, withOrg } from "@/lib/org";
import { recordPayment } from "@/lib/actions";
import { sendPaymentReceipt } from "@/lib/email/receipts";
import { sendPaymentReceiptSms } from "@/lib/sms/receipts";
import { revalidatePath } from "next/cache";

// Money actually arrived for these — they can be applied to an invoice.
const APPLICABLE = ["unmatched", "amount_mismatch", "received"];
// Failed/cancelled attempts carry no money but can be dismissed from review.
const DISMISSIBLE = [...APPLICABLE, "failed"];

export async function applyEventToInvoiceAction(eventId: number, documentId: number) {
  return withOrg(async () => {
    await requirePerm("invoices");
    const o = await getOrg();

    // Atomic claim: only one concurrent apply can move the row to 'applying'
    const [event] = await db.update(paymentEvents)
      .set({ status: "applying" })
      .where(and(
        eq(paymentEvents.id, eventId),
        eq(paymentEvents.orgId, o.id),
        eq(paymentEvents.direction, "in"),
        inArray(paymentEvents.status, APPLICABLE),
      ))
      .returning();
    if (!event) return { error: "Event not found or already processed" };

    try {
      const [doc] = await db.select().from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.orgId, o.id), eq(documents.type, "invoice")));
      if (!doc) throw new Error("Invoice not found");

      const outstanding = doc.totalCents - doc.paidCents;
      if (event.amountCents > outstanding) {
        throw new Error(`Amount exceeds invoice outstanding (${outstanding / 100} KES) — overpayments need a credit note`);
      }

      const paymentId = await recordPayment({
        documentId,
        amountCents: event.amountCents,
        method: event.gatewayId === "mpesa_daraja" ? "mpesa" : "kopokopo",
        reference: event.providerRef,
        date: new Date().toISOString().split("T")[0],
        direction: "in",
      });

      await db.update(paymentEvents)
        .set({ status: "applied", matchedDocumentId: documentId, paymentId })
        .where(eq(paymentEvents.id, event.id));

      if (paymentId) {
        await sendPaymentReceipt(paymentId).catch(e => console.error("Receipt failed:", e));
        await sendPaymentReceiptSms(paymentId);
      }

      revalidatePath("/sales/payments/events");
      return { success: true };
    } catch (err: any) {
      // Roll the claim back so the event stays reviewable
      await db.update(paymentEvents).set({ status: event.status }).where(eq(paymentEvents.id, event.id));
      return { error: err.message || "Failed to apply payment" };
    }
  });
}

export async function dismissEventAction(eventId: number, reason: string) {
  return withOrg(async () => {
    await requirePerm("invoices");
    const o = await getOrg();

    // Reason is appended to rawJson so the original accountRef stays intact
    const [existing] = await db.select().from(paymentEvents)
      .where(and(eq(paymentEvents.id, eventId), eq(paymentEvents.orgId, o.id)));
    if (!existing) return { error: "Event not found" };
    let raw: any = {};
    try { raw = existing.rawJson ? JSON.parse(existing.rawJson) : {}; } catch { raw = { original: existing.rawJson }; }
    raw._dismissed = { reason: reason.slice(0, 200), at: new Date().toISOString() };

    const [event] = await db.update(paymentEvents)
      .set({ status: "dismissed", rawJson: JSON.stringify(raw) })
      .where(and(
        eq(paymentEvents.id, eventId),
        eq(paymentEvents.orgId, o.id),
        inArray(paymentEvents.status, DISMISSIBLE),
      ))
      .returning({ id: paymentEvents.id });
    if (!event) return { error: "Event not found or already processed" };

    revalidatePath("/sales/payments/events");
    return { success: true };
  });
}
