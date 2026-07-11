import { db, documents, contacts } from "@/db";
import { and, eq, sql, inArray } from "drizzle-orm";
import { InboundPayment } from "./gateway";

export async function matchPayment(orgId: number, payment: InboundPayment): Promise<number | null> {
  // 1. & 2. Try exact accountRef match against invoice number
  if (payment.accountRef) {
    const cleanRef = payment.accountRef.trim().toUpperCase();
    // Only match against invoices (docType = invoice) that are open or partial
    const [inv] = await db
      .select({ id: documents.id, totalCents: documents.totalCents, paidCents: documents.paidCents })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, orgId),
          eq(documents.type, "invoice"),
          eq(documents.number, cleanRef)
        )
      );

    if (inv && (inv.totalCents - inv.paidCents) > 0) {
      return inv.id;
    }
  }

  // 3. Fallback: Phone + Amount match for till payments (Buy Goods)
  // Find a contact with this phone number, then an open invoice for the exact amount.
  if (payment.payerPhone) {
    let rawPhone = payment.payerPhone.replace(/\D/g, "");
    if (rawPhone.startsWith("254")) {
      rawPhone = "0" + rawPhone.slice(3); // standardize to 07...
    }
    
    // M-Pesa phone numbers could be formatted differently in contacts, doing a basic %LIKE% match
    const matchingContacts = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.orgId, orgId),
          sql`REGEXP_REPLACE(${contacts.phone}, '[^0-9]', '', 'g') LIKE ${'%' + rawPhone.slice(-9)}`
        )
      );

    if (matchingContacts.length > 0) {
      const contactIds = matchingContacts.map(c => c.id);
      
      // Find all open/partial invoices for these contacts matching the exact amount
      const candidateInvoices = await db
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.orgId, orgId),
            eq(documents.type, "invoice"),
            inArray(documents.contactId, contactIds),
            sql`status IN ('open', 'partial')`,
            eq(sql`${documents.totalCents} - ${documents.paidCents}`, payment.amountCents)
          )
        );
        
      // Only auto-apply if there's exactly one candidate
      if (candidateInvoices.length === 1) {
        return candidateInvoices[0].id;
      }
    }
  }

  return null;
}
