import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
process.env.BIASHARA_ORG_ID = "1";
import { db, documents, contacts } from "../db";
import { orgContext } from "../lib/org";
import { saveDocument } from "../lib/actions";
import { eq, and } from "drizzle-orm";

const safe = async <T>(fn: () => Promise<T>) => {
  try { return await fn(); } catch (e: any) {
    if (String(e?.message || e).includes("static generation store")) return undefined as any;
    throw e;
  }
};

async function main() {
  await orgContext.run(1, async () => {
    const [cust] = await db.select().from(contacts).where(and(eq(contacts.orgId, 1), eq(contacts.kind, "customer"))).limit(1);
    const [inv] = await db.select().from(documents).where(and(eq(documents.orgId, 1), eq(documents.type, "invoice"))).limit(1);
    if (!cust || !inv) { console.log("need a customer + invoice in org 1"); process.exit(0); }
    console.log(`customer=${cust.displayName}(${cust.id}) invoice=${inv.number}(${inv.id}) invoiceOwner=${inv.contactId}`);

    const line = [{ description: "Site transport", qty: 1, unitPriceCents: 50000, discountPct: 0, taxClass: "B16" as const }];
    const created: number[] = [];

    // 1. expense tagged to customer + the customer's own invoice
    const okId = await safe(() => saveDocument({
      type: "expense", contactId: null, date: "2026-07-29", taxInclusive: false,
      paidFromBankAccountId: null, customerContactId: inv.contactId, relatedInvoiceId: inv.id, lines: line,
    }));
    created.push(okId);
    const [row] = await db.select().from(documents).where(eq(documents.id, okId));
    console.log(`valid link stored: customer=${row.customerContactId} invoice=${row.relatedInvoiceId}`);

    // 2. invoice belonging to a DIFFERENT customer must be rejected
    const other = (await db.select().from(contacts).where(and(eq(contacts.orgId, 1), eq(contacts.kind, "customer")))).find(c => c.id !== inv.contactId);
    if (other) {
      let blocked = false;
      try {
        await safe(() => saveDocument({ type: "expense", contactId: null, date: "2026-07-29", taxInclusive: false, customerContactId: other.id, relatedInvoiceId: inv.id, lines: line }));
      } catch (e: any) { blocked = /different customer/.test(e.message); }
      console.log("mismatched customer/invoice blocked:", blocked);
    }

    // 3. invoice without a customer must be rejected
    let noCust = false;
    try {
      await safe(() => saveDocument({ type: "expense", contactId: null, date: "2026-07-29", taxInclusive: false, relatedInvoiceId: inv.id, lines: line }));
    } catch (e: any) { noCust = /before linking an invoice/.test(e.message); }
    console.log("invoice-without-customer blocked:", noCust);

    // 4. attribution must be dropped on a sales document
    const saleId = await safe(() => saveDocument({
      type: "quote", contactId: cust.id, date: "2026-07-29", taxInclusive: false,
      customerContactId: cust.id, relatedInvoiceId: inv.id, lines: line,
    }));
    created.push(saleId);
    const [sale] = await db.select().from(documents).where(eq(documents.id, saleId));
    console.log(`attribution dropped on quote: customer=${sale.customerContactId} invoice=${sale.relatedInvoiceId}`);

    for (const id of created.filter(Boolean)) {
      await db.delete(documents).where(eq(documents.id, id));
    }
    console.log("cleaned up", created.filter(Boolean).length, "test docs");
  });
  process.exit(0);
}
main();
