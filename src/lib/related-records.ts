import { db, documents, contacts, payments, documentLines, loanLedger, payrollRunLineItems, payrollRuns } from "@/db";
import { and, eq, ne, desc, inArray } from "drizzle-orm";
import { fmtKES } from "@/lib/money";

export interface RelatedRecord {
  type: string;
  title: string;
  subtitle: string;
  href: string;
}

const DOC_LIST_HREF: Record<string, string> = {
  quote: "/sales/quotes",
  invoice: "/sales/invoices",
  credit_note: "/sales/credit-notes",
  bill: "/purchases/bills",
  purchase_order: "/purchases/orders",
  expense: "/purchases/expenses",
};

function docHref(type: string, id: number) {
  return `${DOC_LIST_HREF[type] || "/sales/invoices"}/${id}`;
}

/**
 * A handful of records connected to the given one, for the "Related"
 * suggestions area under a global-search top match — e.g. an invoice's
 * customer, the payments applied to it, and the quote it came from. Every
 * lookup is org-scoped; capped small since this runs for one result, not
 * the whole list.
 */
export async function getRelatedRecords(orgId: number, type: string, id: number): Promise<RelatedRecord[]> {
  if (type in DOC_LIST_HREF) return getDocumentRelated(orgId, type, id);
  if (type === "customer" || type === "vendor") return getContactRelated(orgId, id);
  if (type === "item") return getItemRelated(orgId, id);
  if (type === "employee") return getEmployeeRelated(orgId, id);
  return [];
}

async function getDocumentRelated(orgId: number, type: string, id: number): Promise<RelatedRecord[]> {
  const [doc] = await db.select().from(documents).where(and(eq(documents.orgId, orgId), eq(documents.id, id))).limit(1);
  if (!doc) return [];
  const related: RelatedRecord[] = [];

  if (doc.contactId) {
    const [c] = await db.select({ id: contacts.id, name: contacts.displayName, kind: contacts.kind })
      .from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, doc.contactId))).limit(1);
    if (c) related.push({ type: c.kind, title: c.name, subtitle: c.kind === "customer" ? "Customer" : "Vendor", href: `/contacts/${c.id}` });
  }

  const docPayments = await db.select({ id: payments.id, number: payments.number, amountCents: payments.amountCents, direction: payments.direction })
    .from(payments).where(and(eq(payments.orgId, orgId), eq(payments.documentId, id))).orderBy(desc(payments.id)).limit(3);
  for (const p of docPayments) {
    related.push({ type: "payment", title: p.number, subtitle: `Payment ${fmtKES(p.amountCents)}`, href: `/sales/payments/${p.id}` });
  }

  if (doc.sourceDocId) {
    const [src] = await db.select({ id: documents.id, number: documents.number, type: documents.type })
      .from(documents).where(and(eq(documents.orgId, orgId), eq(documents.id, doc.sourceDocId))).limit(1);
    if (src) related.push({ type: src.type, title: src.number, subtitle: `Originated from this ${src.type.replace("_", " ")}`, href: docHref(src.type, src.id) });
  }

  if (doc.relatedInvoiceId) {
    const [inv] = await db.select({ id: documents.id, number: documents.number })
      .from(documents).where(and(eq(documents.orgId, orgId), eq(documents.id, doc.relatedInvoiceId))).limit(1);
    if (inv) related.push({ type: "invoice", title: inv.number, subtitle: "Rebilled onto this invoice", href: docHref("invoice", inv.id) });
  }

  // Documents generated FROM this one (e.g. the invoice a quote converted to).
  const derived = await db.select({ id: documents.id, number: documents.number, type: documents.type })
    .from(documents).where(and(eq(documents.orgId, orgId), eq(documents.sourceDocId, id))).limit(3);
  for (const d of derived) {
    related.push({ type: d.type, title: d.number, subtitle: `Converted from this ${doc.type.replace("_", " ")}`, href: docHref(d.type, d.id) });
  }

  // Other recent documents for the same contact.
  if (doc.contactId) {
    const siblings = await db.select({ id: documents.id, number: documents.number, type: documents.type })
      .from(documents)
      .where(and(eq(documents.orgId, orgId), eq(documents.contactId, doc.contactId), ne(documents.id, id)))
      .orderBy(desc(documents.date)).limit(3);
    for (const s of siblings) {
      related.push({ type: s.type, title: s.number, subtitle: `Other ${s.type.replace("_", " ")} for this contact`, href: docHref(s.type, s.id) });
    }
  }

  return related;
}

async function getContactRelated(orgId: number, contactId: number): Promise<RelatedRecord[]> {
  const docs = await db.select({ id: documents.id, number: documents.number, type: documents.type, totalCents: documents.totalCents })
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.contactId, contactId)))
    .orderBy(desc(documents.date)).limit(5);
  return docs.map((d) => ({ type: d.type, title: d.number, subtitle: `${d.type.replace("_", " ")} — ${fmtKES(d.totalCents)}`, href: docHref(d.type, d.id) }));
}

async function getItemRelated(orgId: number, itemId: number): Promise<RelatedRecord[]> {
  const lines = await db.select({ documentId: documentLines.documentId })
    .from(documentLines)
    .where(and(eq(documentLines.orgId, orgId), eq(documentLines.itemId, itemId)))
    .orderBy(desc(documentLines.id)).limit(5);
  const docIds = [...new Set(lines.map((l) => l.documentId))];
  if (docIds.length === 0) return [];
  const docs = await db.select({ id: documents.id, number: documents.number, type: documents.type })
    .from(documents).where(and(eq(documents.orgId, orgId), inArray(documents.id, docIds)));
  return docs.map((d) => ({ type: d.type, title: d.number, subtitle: `Recent ${d.type.replace("_", " ")} using this item`, href: docHref(d.type, d.id) }));
}

async function getEmployeeRelated(orgId: number, employeeId: number): Promise<RelatedRecord[]> {
  const related: RelatedRecord[] = [];

  const loans = await db.select({ id: loanLedger.id, balanceCents: loanLedger.balanceCents, status: loanLedger.status })
    .from(loanLedger).where(and(eq(loanLedger.orgId, orgId), eq(loanLedger.employeeId, employeeId))).limit(3);
  for (const l of loans) {
    related.push({ type: "loan", title: `Loan #${l.id}`, subtitle: `${l.status} — balance ${fmtKES(l.balanceCents)}`, href: `/payroll/loans/${l.id}` });
  }

  const payslips = await db.select({ runId: payrollRuns.id, month: payrollRuns.month, grossPay: payrollRunLineItems.amountCents })
    .from(payrollRunLineItems)
    .innerJoin(payrollRuns, eq(payrollRunLineItems.payrollRunId, payrollRuns.id))
    .where(and(eq(payrollRunLineItems.employeeId, employeeId), eq(payrollRunLineItems.type, "gross_pay")))
    .orderBy(desc(payrollRuns.month)).limit(3);
  for (const p of payslips) {
    related.push({ type: "payroll_run", title: p.month, subtitle: `Payslip — gross ${fmtKES(p.grossPay)}`, href: `/payroll/runs/${p.runId}` });
  }

  return related;
}
