import { db, payments, documents, contacts, org, smsLog, paymentEvents } from "@/db";
import { and, eq, desc } from "drizzle-orm";
import { fmtKES } from "@/lib/money";
import { getOrCreateReceiptToken, receiptUrl } from "@/lib/receipts/tokens";
import { getOrgSmsConfig, sendSms } from "./index";

/**
 * SMS the payer a receipt link after a payment is applied.
 * Idempotent: the unique index on sms_log.payment_id means a payment can
 * only ever get one receipt SMS, even across webhook retries.
 * Never throws — receipt delivery must not break payment recording.
 */
export async function sendPaymentReceiptSms(paymentId: number): Promise<void> {
  try {
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
    if (!payment || payment.direction !== "in") return;

    const cfg = await getOrgSmsConfig(payment.orgId);
    if (!cfg) return; // SMS not enabled for this org

    // Claim the dedupe slot BEFORE sending (conflict = already sent/sending)
    const [claimed] = await db.insert(smsLog).values({
      orgId: payment.orgId,
      paymentId,
      phone: "",
      message: "",
      status: "sending",
      createdAt: new Date().toISOString(),
    }).onConflictDoNothing({ target: [smsLog.paymentId] }).returning({ id: smsLog.id });
    if (!claimed) return;

    // Best phone: gateway event payer phone, else contact phone
    const [event] = await db.select().from(paymentEvents)
      .where(and(eq(paymentEvents.orgId, payment.orgId), eq(paymentEvents.paymentId, paymentId)))
      .orderBy(desc(paymentEvents.id)).limit(1);
    let phone = event?.payerPhone || null;

    if (!phone && payment.contactId) {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, payment.contactId));
      phone = contact?.phone || null;
    }
    if (!phone) {
      await db.update(smsLog).set({ status: "failed", error: "No payer phone" }).where(eq(smsLog.id, claimed.id));
      return;
    }

    const [o] = await db.select().from(org).where(eq(org.id, payment.orgId));
    const [doc] = payment.documentId
      ? await db.select().from(documents).where(eq(documents.id, payment.documentId))
      : [undefined];

    const token = await getOrCreateReceiptToken(payment.orgId, paymentId);
    const link = receiptUrl(token);
    const message =
      `${fmtKES(payment.amountCents)} received` +
      (doc ? ` for ${doc.number}` : "") +
      `. Receipt: ${link}` +
      (o?.name ? ` - ${o.name}` : "");

    const result = await sendSms(cfg, phone, message);

    await db.update(smsLog).set({
      phone,
      message,
      status: result.ok ? "sent" : "failed",
      providerRef: result.providerRef,
      error: result.error,
    }).where(eq(smsLog.id, claimed.id));

    if (!result.ok) console.error("Receipt SMS failed:", result.error);
  } catch (e) {
    console.error("sendPaymentReceiptSms error:", e);
  }
}
