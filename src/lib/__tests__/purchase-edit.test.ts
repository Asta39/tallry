/**
 * Integration tests for editing purchases before payment: a recorded, unpaid
 * bill re-posts with its new amounts (old entry reversed, AP left at the new
 * total), a paid bill stays locked, and a purchase order can change until any
 * of it is billed. Also merges two quotes end to end. Runs against the live
 * database inside org 1 (same convention as ledger.test.ts); everything
 * written here is deleted in a finally block, and org 1's bill-approval
 * setting is switched off only for the duration (so no approval SMS is sent)
 * and restored afterwards.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  db, org, contacts, documents, documentLines, documentAssignments, journalEntries, journalLines,
  costCenters, stockLots, bankTransactions,
} from "@/db";
import { orgContext } from "../org";
import { acct } from "../posting";
import { SYS } from "../coa";
import { saveDocument, issueDocument, convertPoToBill, mergeQuotesAction } from "../actions";

const ORG = 1;
const TODAY = new Date().toISOString().slice(0, 10);
const inOrg = <T>(fn: () => Promise<T>) => orgContext.run(ORG, fn);

async function setup() {
  const [vendor] = await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.orgId, ORG)).limit(1);
  const [cc] = await db.select({ id: costCenters.id }).from(costCenters).where(eq(costCenters.orgId, ORG)).limit(1);
  const expenseAccountId = await inOrg(() => acct("6900"));
  return { vendorId: vendor.id, costCenterId: cc?.id ?? null, expenseAccountId };
}

const billLine = (ctx: Awaited<ReturnType<typeof setup>>, description: string, qty: number, unitPriceCents: number) => ({
  description,
  qty,
  unitPriceCents,
  discountPct: 0,
  taxClass: "B16" as const,
  accountId: ctx.expenseAccountId,
  costCenterId: ctx.costCenterId,
});

const payout = { payoutDestinationType: "phone" as const, payoutDestination: "254700000000" };

/** Net AP credit for a document across all its journal entries (posted + reversals). */
async function apBalanceFor(docNumber: string) {
  const apId = await inOrg(() => acct(SYS.AP));
  const [row] = await db
    .select({ net: sql<number>`coalesce(sum(${journalLines.creditCents}) - sum(${journalLines.debitCents}), 0)::bigint` })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
    .where(and(eq(journalEntries.orgId, ORG), eq(journalLines.accountId, apId), sql`${journalEntries.memo} like ${"%" + docNumber}`));
  return Number(row.net);
}

async function cleanup(docIds: number[]) {
  if (!docIds.length) return;
  const docs = await db.select({ id: documents.id, number: documents.number }).from(documents).where(inArray(documents.id, docIds));
  for (const d of docs) {
    const entries = await db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(and(eq(journalEntries.orgId, ORG), or(and(eq(journalEntries.sourceId, d.id), inArray(journalEntries.sourceType, ["bill"])), sql`${journalEntries.memo} like ${"%" + d.number}`)));
    const ids = entries.map((e) => e.id);
    if (ids.length) {
      await db.delete(bankTransactions).where(inArray(bankTransactions.journalEntryId, ids));
      await db.delete(journalLines).where(inArray(journalLines.entryId, ids));
      await db.update(documents).set({ journalEntryId: null }).where(inArray(documents.journalEntryId, ids));
      await db.delete(journalEntries).where(inArray(journalEntries.id, ids));
    }
  }
  await db.delete(stockLots).where(and(eq(stockLots.orgId, ORG), eq(stockLots.sourceType, "bill"), inArray(stockLots.sourceId, docIds)));
  await db.delete(documentAssignments).where(inArray(documentAssignments.documentId, docIds));
  await db.update(documents).set({ sourceDocId: null }).where(inArray(documents.id, docIds));
  await db.delete(documentLines).where(inArray(documentLines.documentId, docIds));
  await db.delete(documents).where(inArray(documents.id, docIds));
}

async function withApprovalsOff<T>(fn: () => Promise<T>): Promise<T> {
  const [before] = await db.select({ v: org.requireBillApproval }).from(org).where(eq(org.id, ORG));
  await db.update(org).set({ requireBillApproval: false }).where(eq(org.id, ORG));
  try {
    return await fn();
  } finally {
    await db.update(org).set({ requireBillApproval: before.v }).where(eq(org.id, ORG));
  }
}

test("a recorded, unpaid bill can be edited — it re-posts at the new total", async () => {
  const ctx = await setup();
  const created: number[] = [];
  try {
    await withApprovalsOff(async () => {
      const billNumber = `EDIT-TEST-${Date.now()}`;
      const id = await inOrg(() =>
        saveDocument({ type: "bill", contactId: ctx.vendorId, date: TODAY, taxInclusive: false, billNumber, ...payout, lines: [billLine(ctx, "Morning delivery", 10, 50_000)] }),
      );
      created.push(id);
      const issued = await inOrg(() => issueDocument(id));
      assert.equal(issued.error, undefined);
      let [doc] = await db.select().from(documents).where(eq(documents.id, id));
      assert.equal(doc.status, "open");
      assert.equal(doc.totalCents, 580_000);
      assert.equal(await apBalanceFor(billNumber), 580_000);

      // The vendor brings more in the afternoon: add a line to the same bill.
      await inOrg(() =>
        saveDocument({
          id, type: "bill", contactId: ctx.vendorId, date: TODAY, taxInclusive: false, billNumber, ...payout,
          lines: [billLine(ctx, "Morning delivery", 10, 50_000), billLine(ctx, "Afternoon delivery", 4, 50_000)],
        }),
      );
      [doc] = await db.select().from(documents).where(eq(documents.id, id));
      assert.equal(doc.status, "open");
      assert.equal(doc.totalCents, 812_000);
      assert.ok(doc.journalEntryId, "re-posted with a fresh entry");
      // Original entry + its reversal + the new entry net to the new total.
      assert.equal(await apBalanceFor(billNumber), 812_000);
      const lines = await db.select().from(documentLines).where(eq(documentLines.documentId, id));
      assert.equal(lines.length, 2);
    });
  } finally {
    await cleanup(created);
  }
});

test("a bill with a payment against it can't be edited", async () => {
  const ctx = await setup();
  const created: number[] = [];
  try {
    await withApprovalsOff(async () => {
      const billNumber = `EDIT-PAID-${Date.now()}`;
      const id = await inOrg(() =>
        saveDocument({ type: "bill", contactId: ctx.vendorId, date: TODAY, taxInclusive: false, billNumber, ...payout, lines: [billLine(ctx, "Goods", 1, 10_000)] }),
      );
      created.push(id);
      await inOrg(() => issueDocument(id));
      // Simulate a part payment without touching the ledger.
      await db.update(documents).set({ paidCents: 5_000, status: "partial" }).where(eq(documents.id, id));
      await assert.rejects(
        inOrg(() =>
          saveDocument({ id, type: "bill", contactId: ctx.vendorId, date: TODAY, taxInclusive: false, billNumber, ...payout, lines: [billLine(ctx, "Goods", 2, 10_000)] }),
        ),
        /already has a payment/,
      );
      const [doc] = await db.select().from(documents).where(eq(documents.id, id));
      assert.equal(doc.totalCents, 11_600, "unchanged");
      await db.update(documents).set({ paidCents: 0, status: "open" }).where(eq(documents.id, id));
    });
  } finally {
    await cleanup(created);
  }
});

test("a sent purchase order can be edited until part of it is billed", async () => {
  const ctx = await setup();
  const created: number[] = [];
  try {
    const id = await inOrg(() =>
      saveDocument({ type: "purchase_order", contactId: ctx.vendorId, date: TODAY, taxInclusive: false, ...payout, lines: [billLine(ctx, "Timber", 20, 30_000)] }),
    );
    created.push(id);
    await inOrg(() => issueDocument(id));
    await inOrg(() =>
      saveDocument({
        id, type: "purchase_order", contactId: ctx.vendorId, date: TODAY, taxInclusive: false, ...payout,
        lines: [billLine(ctx, "Timber", 25, 30_000), billLine(ctx, "Nails", 5, 2_000)],
      }),
    );
    let [po] = await db.select().from(documents).where(eq(documents.id, id));
    assert.equal(po.status, "open");
    assert.equal(po.subtotalCents, 25 * 30_000 + 5 * 2_000);

    // Bill part of it; after that the PO's lines are locked.
    const poLines = await db.select().from(documentLines).where(eq(documentLines.documentId, id)).orderBy(documentLines.position);
    const billId = await withApprovalsOff(() => inOrg(() => convertPoToBill(id, { [poLines[0].id]: 10, [poLines[1].id]: 0 })));
    created.push(billId);
    [po] = await db.select().from(documents).where(eq(documents.id, id));
    assert.equal(po.status, "partial");
    await assert.rejects(
      inOrg(() =>
        saveDocument({ id, type: "purchase_order", contactId: ctx.vendorId, date: TODAY, taxInclusive: false, ...payout, lines: [billLine(ctx, "Timber", 30, 30_000)] }),
      ),
      /hasn't been billed yet/,
    );
  } finally {
    await cleanup(created);
  }
});

test("two quotes for one customer merge into one new quote", async () => {
  const ctx = await setup();
  const created: number[] = [];
  try {
    const quote = (description: string, qty: number) =>
      inOrg(() =>
        saveDocument({
          type: "quote", contactId: ctx.vendorId, date: TODAY, taxInclusive: false,
          lines: [{ description, qty, unitPriceCents: 10_000, discountPct: 0, taxClass: "B16" }],
        }),
      );
    const a = await quote("Site survey", 1);
    const b = await quote("Installation", 3);
    created.push(a, b);
    const res = await inOrg(() => mergeQuotesAction([a, b]));
    assert.equal(res.error, undefined);
    created.push(res.id!);

    const [merged] = await db.select().from(documents).where(eq(documents.id, res.id!));
    assert.equal(merged.type, "quote");
    assert.equal(merged.status, "draft");
    assert.equal(merged.contactId, ctx.vendorId);
    assert.equal(merged.subtotalCents, 40_000);
    const lines = await db.select().from(documentLines).where(eq(documentLines.documentId, res.id!)).orderBy(documentLines.position);
    assert.deepEqual(lines.map((l) => [l.description, l.isHeading]), [
      [`From ${(await db.select().from(documents).where(eq(documents.id, a)))[0].number}`, true],
      ["Site survey", false],
      [`From ${(await db.select().from(documents).where(eq(documents.id, b)))[0].number}`, true],
      ["Installation", false],
    ]);
    const sources = await db.select().from(documents).where(inArray(documents.id, [a, b]));
    for (const s of sources) {
      assert.equal(s.status, "merged");
      assert.equal(s.sourceDocId, res.id);
    }
    // Merging them again is refused.
    const again = await inOrg(() => mergeQuotesAction([a, b]));
    assert.match(again.error!, /only draft, sent or accepted/);
  } finally {
    await cleanup(created);
  }
});
