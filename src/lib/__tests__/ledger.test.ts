/**
 * Integration tests for the double-entry engine and financial reports.
 * Runs against the live database (same as smoke.ts) inside org 1's context;
 * every entry written here is deleted in a finally block.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { orgContext } from "../org";
import { postEntry, acct, reverseEntry } from "../posting";
import { accountBalances, balanceSheet, profitAndLoss, accountOpeningBalance } from "../reports";
import { db, journalEntries, journalLines, org } from "@/db";
import { eq, sql } from "drizzle-orm";

const ORG = 1;
const TODAY = new Date().toISOString().slice(0, 10);

function inOrg<T>(fn: () => Promise<T>): Promise<T> {
  return orgContext.run(ORG, fn);
}

async function deleteEntry(entryId: number) {
  await db.delete(journalLines).where(eq(journalLines.entryId, entryId));
  await db.delete(journalEntries).where(eq(journalEntries.id, entryId));
}

test("postEntry rejects an unbalanced entry", async () => {
  await inOrg(async () => {
    const bank = await acct("1000");
    const sales = await acct("4000");
    await assert.rejects(
      postEntry({
        date: TODAY,
        sourceType: "test",
        lines: [
          { accountId: bank, debitCents: 10_000 },
          { accountId: sales, creditCents: 9_999 },
        ],
      }),
      /Unbalanced entry/
    );
  });
});

test("postEntry rejects an empty entry", async () => {
  await inOrg(async () => {
    await assert.rejects(
      postEntry({ date: TODAY, sourceType: "test", lines: [{ accountId: 1, debitCents: 0 }] }),
      /Empty journal entry/
    );
  });
});

test("balanced entry writes journal rows and reports carry correct signs", async () => {
  let entryId: number | undefined;
  try {
    await inOrg(async () => {
      const bank = await acct("1000");
      const sales = await acct("4000");

      const before = await accountBalances({ to: TODAY });
      const bankBefore = before.find((b) => b.accountId === bank)?.balanceCents ?? 0;
      const salesBefore = before.find((b) => b.accountId === sales)?.balanceCents ?? 0;

      entryId = await postEntry({
        date: TODAY,
        memo: "LEDGERTEST",
        sourceType: "test",
        lines: [
          { accountId: bank, debitCents: 12_345 },
          { accountId: sales, creditCents: 12_345 },
        ],
      });

      const lines = await db.select().from(journalLines).where(eq(journalLines.entryId, entryId));
      assert.equal(lines.length, 2);

      const after = await accountBalances({ to: TODAY });
      const bankAfter = after.find((b) => b.accountId === bank)!.balanceCents;
      const salesAfter = after.find((b) => b.accountId === sales)!.balanceCents;
      // Asset debited → natural balance rises; income credited → natural balance rises
      assert.equal(bankAfter - bankBefore, 12_345);
      assert.equal(salesAfter - salesBefore, 12_345);
    });
  } finally {
    if (entryId) await deleteEntry(entryId);
  }
});

test("reverseEntry exactly cancels the original", async () => {
  let entryId: number | undefined;
  let reversalId: number | undefined;
  try {
    await inOrg(async () => {
      const bank = await acct("1000");
      const sales = await acct("4000");
      const before = await accountBalances({ to: TODAY });
      const bankBefore = before.find((b) => b.accountId === bank)?.balanceCents ?? 0;

      entryId = await postEntry({
        date: TODAY,
        sourceType: "test",
        lines: [
          { accountId: bank, debitCents: 5_000 },
          { accountId: sales, creditCents: 5_000 },
        ],
      });
      reversalId = await reverseEntry(entryId, TODAY, "LEDGERTEST reversal");

      const after = await accountBalances({ to: TODAY });
      const bankAfter = after.find((b) => b.accountId === bank)!.balanceCents;
      assert.equal(bankAfter, bankBefore);
    });
  } finally {
    if (reversalId) await deleteEntry(reversalId);
    if (entryId) await deleteEntry(entryId);
  }
});

test("period lock rejects entries on or before the lock date", async () => {
  const [orgRow] = await db.select({ lockDate: org.lockDate }).from(org).where(eq(org.id, ORG));
  const originalLock = orgRow.lockDate;
  try {
    await db.update(org).set({ lockDate: TODAY }).where(eq(org.id, ORG));
    await inOrg(async () => {
      const bank = await acct("1000");
      const sales = await acct("4000");
      await assert.rejects(
        postEntry({
          date: TODAY, // on the lock date — must be rejected
          sourceType: "test",
          lines: [
            { accountId: bank, debitCents: 1_000 },
            { accountId: sales, creditCents: 1_000 },
          ],
        }),
        /locked/
      );
    });
  } finally {
    await db.update(org).set({ lockDate: originalLock }).where(eq(org.id, ORG));
  }
});

test("global ledger invariant: sum of debits equals sum of credits", async () => {
  const [sums] = await db
    .select({
      dr: sql<string>`coalesce(sum(${journalLines.debitCents}), 0)`,
      cr: sql<string>`coalesce(sum(${journalLines.creditCents}), 0)`,
    })
    .from(journalLines);
  assert.equal(Number(sums.dr), Number(sums.cr));
});

test("balance sheet identity: assets = liabilities + equity", async () => {
  await inOrg(async () => {
    const bs = await balanceSheet(TODAY);
    assert.equal(bs.totalAssets, bs.totalLiabilities + bs.totalEquity);
  });
});

test("P&L internal consistency", async () => {
  await inOrg(async () => {
    const pl = await profitAndLoss("0000-01-01", TODAY);
    assert.equal(pl.grossProfit, pl.totalIncome - pl.totalCogs);
    assert.equal(pl.netProfit, pl.totalIncome - pl.totalCogs - pl.totalExpenses);
    const sumIncome = pl.income.reduce((s, b) => s + b.balanceCents, 0);
    assert.equal(pl.totalIncome, sumIncome);
  });
});

test("GL opening balance + period movement reconciles to closing balance", async () => {
  await inOrg(async () => {
    const bank = await acct("1000");
    const midYear = `${TODAY.slice(0, 4)}-01-01`;
    const opening = await accountOpeningBalance(bank, midYear);
    const closing = (await accountBalances({ to: TODAY })).find((b) => b.accountId === bank)?.balanceCents ?? 0;
    const period = (await accountBalances({ from: midYear, to: TODAY })).find((b) => b.accountId === bank)?.balanceCents ?? 0;
    assert.equal(opening.balanceCents + period, closing);
  });
});
