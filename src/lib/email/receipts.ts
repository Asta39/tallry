import { db, documents, contacts, payments } from "@/db";
import { eq, and } from "drizzle-orm";
import { sendEmail } from "./resend";
import PaymentReceipt from "./templates/PaymentReceipt";
import { fmtKES } from "@/lib/money";

export async function sendPaymentReceipt(paymentId: number) {
  // Fetch payment, invoice, and contact
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!payment || !payment.documentId) return;

  const [doc] = await db.select().from(documents).where(eq(documents.id, payment.documentId));
  if (!doc) return;

  if (!doc.contactId) return;

  const [contact] = await db.select().from(contacts).where(eq(contacts.id, doc.contactId));
  if (!contact || !contact.email) return;

  // Send the email
  const htmlComponent = PaymentReceipt({
    customerName: contact.displayName || contact.companyName || "Customer",
    amount: fmtKES(payment.amountCents),
    invoiceNumber: doc.number,
    paymentMethod: payment.method,
    receiptNumber: `RCPT-${payment.id}`,
    date: payment.date,
  });

  await sendEmail({
    to: contact.email,
    subject: `Payment Receipt for Invoice ${doc.number}`,
    react: htmlComponent,
  });
}
