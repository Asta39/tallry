/**
 * Integration tests for business borrowings (external loans): interest in the
 * outstanding balance, monthly interest expensing, and payments. Runs against
 * the live database inside org 1's context (same convention as
 * ledger.test.ts); every row written here is deleted in a finally block.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { orgContext } from "../org";
import { acct } from "../posting";
import { addDays } from "../recurring";
import {
  createExternalLoan,
  recordExternalLoanRepayment,
  setupExternalLoanInterest,
  postDueLoanInterest,
  externalLoanOutstanding,
  interestSchedule,
  parseReceiptSource,
  UNEXPIRED_INTEREST_CODE,
} from "../external-loans";
import {
  db, accounts, externalLoans, externalLoanRepayments, externalLoanInterestSchedule,
  journalEntries, journalLines, bankAccounts, bankTransactions,
} from "@/db";
import { and, eq } from "drizzle-orm";

const ORG = 1;
const TODAY = new Date().toISOString().slice(0, 10);

function inOrg<T>(fn: () => Promise<T>): Promise<T> {
  return orgContext.run(ORG, fn);
}

async function deleteEntry(entryId: number | null | undefined) {
  if (!entryId) return;
  await db.delete(bankTransactions).where(eq(bankTransactions.journalEntryId, entryId));
  await db.delete(journalLines).where(eq(journalLines.entryId, entryId));
  await db.delete(journalEntries).where(eq(journalEntries.id, entryId));
}

async function cleanupLoan(loanId: number) {
  const reps = await db.select().from(externalLoanRepayments).where(eq(externalLoanRepayments.loanId, loanId));
  await db.delete(externalLoanRepayments).where(eq(externalLoanRepayments.loanId, loanId));
  for (const r of reps) await deleteEntry(r.journalEntryId);
  const sched = await db.select().from(externalLoanInterestSchedule).where(eq(externalLoanInterestSchedule.loanId, loanId));
  await db.delete(externalLoanInterestSchedule).where(eq(externalLoanInterestSchedule.loanId, loanId));
  for (const r of sched) await deleteEntry(r.journalEntryId);
  const [loan] = await db.select().from(externalLoans).where(eq(externalLoans.id, loanId));
  await db.delete(externalLoans).where(eq(externalLoans.id, loanId));
  await deleteEntry(loan?.receiptJournalEntryId);
  await deleteEntry(loan?.interestSetupEntryId);
}

/** The Unexpired Loan Interest account is created on first use; drop it again
 *  if this test run created it (all its journal lines are deleted above). */
async function withUnexpiredCleanup(fn: () => Promise<void>) {
  const [before] = await db.select().from(accounts).where(and(eq(accounts.orgId, ORG), eq(accounts.code, UNEXPIRED_INTEREST_CODE)));
  try {
    await fn();
  } finally {
    if (!before) await db.delete(accounts).where(and(eq(accounts.orgId, ORG), eq(accounts.code, UNEXPIRED_INTEREST_CODE)));
  }
}

async function bank() {
  const [b] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, ORG), eq(bankAccounts.archived, false))).limit(1);
  assert.ok(b, "org 1 needs a bank account");
  return b;
}

const shape = (lines: { accountId: number; debitCents: number; creditCents: number }[]) =>
  lines.map((l) => [l.accountId, l.debitCents, l.creditCents]).sort();
const linesOf = (entryId: number) => db.select().from(journalLines).where(eq(journalLines.entryId, entryId));

test("parseReceiptSource accepts an account id or already_recorded only", () => {
  assert.equal(parseReceiptSource("already_recorded"), "already_recorded");
  assert.equal(parseReceiptSource("7"), 7);
  assert.equal(parseReceiptSource(""), null);
  assert.equal(parseReceiptSource("x"), null);
});

test("interestSchedule spreads interest evenly over month-ends, remainder in the last month", () => {
  const s = interestSchedule("2026-09-25", 12, 60_000);
  assert.equal(s.length, 12);
  assert.equal(s[0].periodEnd, "2026-10-31");
  assert.equal(s[11].periodEnd, "2027-09-30");
  assert.ok(s.every((r) => r.amountCents === 5_000));

  assert.deepEqual(interestSchedule("2026-01-01", 3, 100).map((r) => r.amountCents), [33, 33, 34]);
  assert.equal(interestSchedule("2026-09-01", 2, 100)[0].periodEnd, "2026-09-30");
  assert.deepEqual(interestSchedule("2026-01-31", 2, 100).map((r) => r.periodEnd), ["2026-02-28", "2026-03-31"]);
  assert.deepEqual(interestSchedule("2026-01-01", 0, 100), []);
  assert.deepEqual(interestSchedule("2026-01-01", 3, 0), []);
});

test("loan with interest: outstanding includes interest, past months are expensed, payments reduce outstanding", async () => {
  let loanId: number | undefined;
  await withUnexpiredCleanup(async () => {
    try {
      await inOrg(async () => {
        const b = await bank();
        const loanAcc = await acct("2400");
        const interestAcc = await acct("6075");
        const start = addDays(TODAY, -75); // ~2 month-ends already past
        loanId = await createExternalLoan({
          orgId: ORG, lender: "Test Bank", liabilityAccountId: loanAcc, interestAccountId: interestAcc,
          principalCents: 120_000, interestTotalCents: 12_000, termMonths: 6,
          startDate: start, receivedInto: b.id, asOf: TODAY,
        });
        const unexpired = await acct(UNEXPIRED_INTEREST_CODE);
        const [loan] = await db.select().from(externalLoans).where(eq(externalLoans.id, loanId));

        // Principal in, interest onto the loan account up front.
        assert.deepEqual(shape(await linesOf(loan.receiptJournalEntryId!)), shape([
          { accountId: b.accountId, debitCents: 120_000, creditCents: 0 },
          { accountId: loanAcc, debitCents: 0, creditCents: 120_000 },
        ]));
        assert.deepEqual(shape(await linesOf(loan.interestSetupEntryId!)), shape([
          { accountId: unexpired, debitCents: 12_000, creditCents: 0 },
          { accountId: loanAcc, debitCents: 0, creditCents: 12_000 },
        ]));
        assert.equal(await externalLoanOutstanding(ORG, loanId), 132_000);

        // Months whose month-end has passed are expensed; the rest wait.
        const sched = await db.select().from(externalLoanInterestSchedule).where(eq(externalLoanInterestSchedule.loanId, loanId));
        assert.equal(sched.length, 6);
        for (const r of sched) {
          assert.equal(!!r.journalEntryId, r.periodEnd <= TODAY, `month ${r.periodEnd}`);
          if (r.journalEntryId) {
            assert.deepEqual(shape(await linesOf(r.journalEntryId)), shape([
              { accountId: interestAcc, debitCents: 2_000, creditCents: 0 },
              { accountId: unexpired, debitCents: 0, creditCents: 2_000 },
            ]));
          }
        }
        assert.ok(sched.some((r) => r.journalEntryId), "at least one past month posted");
        // Re-running is a no-op (claimed rows aren't posted twice).
        assert.equal((await postDueLoanInterest(ORG, TODAY, loanId)).posted, 0);

        // A payment is one amount: DR loan · CR bank, reduces outstanding.
        const payEntry = await recordExternalLoanRepayment({ orgId: ORG, loanId, date: TODAY, amountCents: 22_000, bankAccountId: b.id, reference: "T1" });
        assert.deepEqual(shape(await linesOf(payEntry)), shape([
          { accountId: loanAcc, debitCents: 22_000, creditCents: 0 },
          { accountId: b.accountId, debitCents: 0, creditCents: 22_000 },
        ]));
        const out = await db.select().from(bankTransactions).where(eq(bankTransactions.journalEntryId, payEntry));
        assert.equal(out[0]?.amountCents, -22_000);
        assert.equal(await externalLoanOutstanding(ORG, loanId), 110_000);

        await assert.rejects(
          recordExternalLoanRepayment({ orgId: ORG, loanId, date: TODAY, amountCents: 110_001, bankAccountId: b.id }),
          /more than is still owed/
        );
        await recordExternalLoanRepayment({ orgId: ORG, loanId, date: TODAY, amountCents: 110_000, bankAccountId: b.id });
        const [closed] = await db.select().from(externalLoans).where(eq(externalLoans.id, loanId));
        assert.equal(closed.status, "closed");
      });
    } finally {
      if (loanId) await cleanupLoan(loanId);
    }
  });
});

test("interest can be added once to a loan registered as already in the books", async () => {
  let loanId: number | undefined;
  await withUnexpiredCleanup(async () => {
    try {
      await inOrg(async () => {
        loanId = await createExternalLoan({
          orgId: ORG, lender: "Test SACCO", liabilityAccountId: await acct("2400"),
          principalCents: 50_000, startDate: TODAY, receivedInto: "already_recorded", asOf: TODAY,
        });
        const [before] = await db.select().from(externalLoans).where(eq(externalLoans.id, loanId));
        assert.equal(before.receiptJournalEntryId, null, "principal already in the books: nothing posted");
        assert.equal(await externalLoanOutstanding(ORG, loanId), 50_000);

        await setupExternalLoanInterest({ orgId: ORG, loanId, interestTotalCents: 6_000, termMonths: 3, interestAccountId: await acct("6075"), asOf: TODAY });
        assert.equal(await externalLoanOutstanding(ORG, loanId), 56_000);
        const sched = await db.select().from(externalLoanInterestSchedule).where(eq(externalLoanInterestSchedule.loanId, loanId));
        assert.equal(sched.length, 3);
        assert.ok(sched.every((r) => !r.journalEntryId), "future months only scheduled");

        await assert.rejects(
          setupExternalLoanInterest({ orgId: ORG, loanId, interestTotalCents: 1_000, termMonths: 3, interestAccountId: await acct("6075"), asOf: TODAY }),
          /already set up/
        );
      });
    } finally {
      if (loanId) await cleanupLoan(loanId);
    }
  });
});

test("createExternalLoan validates the loan account and the interest inputs", async () => {
  await inOrg(async () => {
    await assert.rejects(
      createExternalLoan({ orgId: ORG, lender: "X", liabilityAccountId: await acct("6075"), principalCents: 1_000, startDate: TODAY, receivedInto: "already_recorded", asOf: TODAY }),
      /liability account/
    );
    await assert.rejects(
      createExternalLoan({ orgId: ORG, lender: "X", liabilityAccountId: await acct("2400"), interestAccountId: await acct("6075"), principalCents: 1_000, interestTotalCents: 100, startDate: TODAY, receivedInto: "already_recorded", asOf: TODAY }),
      /term in months/
    );
    await assert.rejects(
      createExternalLoan({ orgId: ORG, lender: "X", liabilityAccountId: await acct("2400"), principalCents: 1_000, interestTotalCents: 100, termMonths: 3, startDate: TODAY, receivedInto: "already_recorded", asOf: TODAY }),
      /interest expense account/
    );
    const leftovers = await db.select().from(externalLoans).where(and(eq(externalLoans.orgId, ORG), eq(externalLoans.lender, "X")));
    assert.equal(leftovers.length, 0, "rejected loans aren't saved");
  });
});
