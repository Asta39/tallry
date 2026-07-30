import { db, documents, contacts, payments, org } from "@/db";
import { eq, and } from "drizzle-orm";
import { sendEmail } from "./resend";
import PaymentReceipt from "./templates/PaymentReceipt";
import { fmtKES } from "@/lib/money";
import { getOrCreateReceiptToken, receiptUrl } from "@/lib/receipts/tokens";

export async function sendPaymentReceipt(paymentId: number) {
  // Fetch payment, invoice, and contact
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!payment || !payment.documentId) return;

  const [doc] = await db.select().from(documents).where(eq(documents.id, payment.documentId));
  if (!doc) return;

  if (!doc.contactId) return;

  const [contact] = await db.select().from(contacts).where(eq(contacts.id, doc.contactId));
  if (!contact || !contact.email) return;

  const [o] = await db.select().from(org).where(eq(org.id, payment.orgId));

  const token = await getOrCreateReceiptToken(payment.orgId, payment.id)
    .catch(e => { console.error("Receipt token failed:", e); return null; });

  // Send the email
  const htmlComponent = PaymentReceipt({
    orgName: o?.name ?? "Your supplier",
    logoUrl: o?.logoUrl,
    brandColor: o?.brandColor,
    customerName: contact.displayName || contact.companyName || "Customer",
    amount: fmtKES(payment.amountCents),
    invoiceNumber: doc.number,
    paymentMethod: payment.method,
    receiptNumber: `RCPT-${payment.id}`,
    reference: payment.reference,
    date: payment.date,
    receiptUrl: token ? await receiptUrl(token) : undefined,
  });

  await sendEmail({
    to: contact.email,
    subject: `Payment Receipt for Invoice ${doc.number} — ${o?.name ?? ""}`,
    react: htmlComponent,
  });
}
