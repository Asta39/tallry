/**
 * Integration test for the whole-document discount: an issued invoice posts
 * revenue and output VAT on the discounted amounts (AR = discounted total),
 * and converting a discounted quote carries the discount to the invoice.
 * Runs against the live database inside org 1 (same convention as
 * ledger.test.ts); everything written is deleted in a finally block.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, contacts, documents, documentLines, documentAssignments, journalEntries, journalLines, bankTransactions } from "@/db";
import { orgContext } from "../org";
import { acct } from "../posting";
import { SYS } from "../coa";
import { saveDocument, issueDocument, convertQuoteToInvoice } from "../actions";

const ORG = 1;
const TODAY = new Date().toISOString().slice(0, 10);
const inOrg = <T>(fn: () => Promise<T>) => orgContext.run(ORG, fn);

async function cleanup(docIds: number[]) {
  if (!docIds.length) return;
  const entries = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(eq(journalEntries.orgId, ORG), inArray(journalEntries.sourceId, docIds), inArray(journalEntries.sourceType, ["invoice"])));
  const ids = entries.map((e) => e.id);
  if (ids.length) {
    await db.delete(bankTransactions).where(inArray(bankTransactions.journalEntryId, ids));
    await db.update(documents).set({ journalEntryId: null }).where(inArray(documents.journalEntryId, ids));
    await db.delete(journalLines).where(inArray(journalLines.entryId, ids));
    await db.delete(journalEntries).where(inArray(journalEntries.id, ids));
  }
  await db.delete(documentAssignments).where(inArray(documentAssignments.documentId, docIds));
  await db.update(documents).set({ sourceDocId: null }).where(inArray(documents.id, docIds));
  await db.delete(documentLines).where(inArray(documentLines.documentId, docIds));
  await db.delete(documents).where(inArray(documents.id, docIds));
}

async function postedAmount(entryId: number, accountId: number, side: "debit" | "credit") {
  const col = side === "debit" ? journalLines.debitCents : journalLines.creditCents;
  const [r] = await db
    .select({ v: sql<number>`coalesce(sum(${col}), 0)::bigint` })
    .from(journalLines)
    .where(and(eq(journalLines.entryId, entryId), eq(journalLines.accountId, accountId)));
  return Number(r.v);
}

test("an invoice with a 10% discount posts revenue and VAT on the discounted amount", async () => {
  const [customer] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.orgId, ORG)).limit(1);
  const created: number[] = [];
  try {
    const id = await inOrg(() =>
      saveDocument({
        type: "invoice", contactId: customer.id, date: TODAY, dueDate: TODAY, taxInclusive: false,
        discount: { type: "percent", value: 10 },
        lines: [
          { description: "Consulting", qty: 2, unitPriceCents: 500_000, discountPct: 0, taxClass: "B16" },
          { description: "Setup", qty: 1, unitPriceCents: 1_000_000, discountPct: 10, taxClass: "B16" },
        ],
      }),
    );
    created.push(id);
    let [doc] = await db.select().from(documents).where(eq(documents.id, id));
    // 10,000 + 9,000 (line discount) = 19,000; 10% off = 1,900 → 17,100 net, VAT 2,736.
    assert.equal(doc.discountType, "percent");
    assert.equal(doc.discountValue, 10);
    assert.equal(doc.discountCents, 190_000);
    assert.equal(doc.subtotalCents, 1_710_000);
    assert.equal(doc.taxCents, 273_600);
    assert.equal(doc.totalCents, 1_983_600);

    const res = await inOrg(() => issueDocument(id));
    assert.equal(res.error, undefined);
    [doc] = await db.select().from(documents).where(eq(documents.id, id));
    const entryId = doc.journalEntryId!;
    const [ar, vat] = await inOrg(() => Promise.all([acct(SYS.AR), acct(SYS.VAT_OUTPUT)]));
    assert.equal(await postedAmount(entryId, ar, "debit"), 1_983_600);
    assert.equal(await postedAmount(entryId, vat, "credit"), 273_600);
    const [{ credits, debits }] = await db
      .select({ credits: sql<number>`sum(${journalLines.creditCents})::bigint`, debits: sql<number>`sum(${journalLines.debitCents})::bigint` })
      .from(journalLines)
      .where(eq(journalLines.entryId, entryId));
    assert.equal(Number(credits), Number(debits), "balanced");
  } finally {
    await cleanup(created);
  }
});

test("converting a discounted quote keeps the discount on the invoice", async () => {
  const [customer] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.orgId, ORG)).limit(1);
  const created: number[] = [];
  try {
    const quoteId = await inOrg(() =>
      saveDocument({
        type: "quote", contactId: customer.id, date: TODAY, taxInclusive: false,
        discount: { type: "fixed", value: 50_000 },
        lines: [{ description: "Package", qty: 1, unitPriceCents: 1_000_000, discountPct: 0, taxClass: "B16" }],
      }),
    );
    created.push(quoteId);
    await inOrg(() => issueDocument(quoteId));
    const invoiceId = await inOrg(() => convertQuoteToInvoice(quoteId));
    created.push(invoiceId);
    const [inv] = await db.select().from(documents).where(eq(documents.id, invoiceId));
    assert.equal(inv.discountType, "fixed");
    assert.equal(inv.discountCents, 50_000);
    assert.equal(inv.subtotalCents, 950_000);
    assert.equal(inv.totalCents, 1_102_000);
  } finally {
    await cleanup(created);
  }
});

test("a USD invoice keeps dollar prices for display and posts shillings to the books", async () => {
  const [customer] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.orgId, ORG)).limit(1);
  const created: number[] = [];
  try {
    // US$ 500.00 × 2 at 130.00 KSh/USD = KSh 130,000.00 net, VAT 20,800.
    const id = await inOrg(() =>
      saveDocument({
        type: "invoice", contactId: customer.id, date: TODAY, dueDate: TODAY, taxInclusive: false,
        currency: "USD", fxRate: 130,
        lines: [{ description: "Consulting (USD)", qty: 2, unitPriceCents: 50_000, discountPct: 0, taxClass: "B16" }],
      }),
    );
    created.push(id);
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    assert.equal(doc.currency, "USD");
    assert.equal(doc.fxRate, 130);
    assert.equal(doc.subtotalCents, 13_000_000);
    assert.equal(doc.totalCents, 15_080_000);
    const [line] = await db.select().from(documentLines).where(eq(documentLines.documentId, id));
    assert.equal(line.fxUnitPriceCents, 50_000, "typed dollar price kept");
    assert.equal(line.unitPriceCents, 6_500_000, "KES price for the books");

    const res = await inOrg(() => issueDocument(id));
    assert.equal(res.error, undefined);
    const [posted] = await db.select().from(documents).where(eq(documents.id, id));
    const ar = await inOrg(() => acct(SYS.AR));
    assert.equal(await postedAmount(posted.journalEntryId!, ar, "debit"), 15_080_000, "receivable in KES");

    await assert.rejects(
      inOrg(() => saveDocument({ type: "invoice", contactId: customer.id, date: TODAY, taxInclusive: false, currency: "USD", lines: [{ description: "x", qty: 1, unitPriceCents: 100, discountPct: 0, taxClass: "B16" }] })),
      /exchange rate/,
    );
  } finally {
    await cleanup(created);
  }
});
