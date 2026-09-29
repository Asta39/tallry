/**
 * Integration tests for staff loan / salary advance disbursement postings.
 * Runs against the live database inside org 1's context (same convention as
 * ledger.test.ts); every row written here is deleted in a finally block.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { orgContext } from "../org";
import { acct } from "../posting";
import { SYS } from "../coa";
import { issueStaffLoan, recordMissingLoanDisbursement, parseDisbursementSource } from "../staff-loans";
import { db, journalEntries, journalLines, loanLedger, employees, bankAccounts, bankTransactions } from "@/db";
import { and, eq } from "drizzle-orm";

const ORG = 1;
const TODAY = new Date().toISOString().slice(0, 10);

function inOrg<T>(fn: () => Promise<T>): Promise<T> {
  return orgContext.run(ORG, fn);
}

async function cleanupLoan(loanId: number) {
  const [loan] = await db.select().from(loanLedger).where(eq(loanLedger.id, loanId));
  const entryId = loan?.disbursementJournalEntryId;
  await db.delete(loanLedger).where(eq(loanLedger.id, loanId));
  if (entryId) {
    await db.delete(bankTransactions).where(eq(bankTransactions.journalEntryId, entryId));
    await db.delete(journalLines).where(eq(journalLines.entryId, entryId));
    await db.delete(journalEntries).where(eq(journalEntries.id, entryId));
  }
}

async function fixtures() {
  const [emp] = await db.select().from(employees).where(eq(employees.orgId, ORG)).limit(1);
  const [bank] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, ORG), eq(bankAccounts.archived, false))).limit(1);
  assert.ok(emp, "org 1 needs an employee");
  assert.ok(bank, "org 1 needs a bank account");
  return { emp, bank };
}

async function linesOf(entryId: number) {
  return db.select().from(journalLines).where(eq(journalLines.entryId, entryId));
}

test("parseDisbursementSource accepts an account id or brought_forward only", () => {
  assert.equal(parseDisbursementSource("brought_forward"), "brought_forward");
  assert.equal(parseDisbursementSource("32"), 32);
  assert.equal(parseDisbursementSource(""), null);
  assert.equal(parseDisbursementSource(null), null);
  assert.equal(parseDisbursementSource("abc"), null);
  assert.equal(parseDisbursementSource("-3"), null);
});

test("brought-forward loan debits Receivables and credits Opening Balance Adjustments", async () => {
  let loanId: number | undefined;
  try {
    await inOrg(async () => {
      const { emp } = await fixtures();
      loanId = await issueStaffLoan({
        orgId: ORG, employeeId: emp.id, principalCents: 12_345, installmentCents: 1_000,
        type: "amortizing", kind: "loan", disbursedFrom: "brought_forward", memoVerb: "Test loan",
      });
      const [loan] = await db.select().from(loanLedger).where(eq(loanLedger.id, loanId));
      assert.ok(loan.disbursementJournalEntryId, "entry recorded on the loan");
      assert.equal(loan.disbursedFromBankAccountId, null);
      const lines = await linesOf(loan.disbursementJournalEntryId!);
      const ar = await acct("1200");
      const ob = await acct(SYS.OPENING_BALANCE);
      assert.deepEqual(
        lines.map((l) => [l.accountId, l.debitCents, l.creditCents]).sort(),
        [[ar, 12_345, 0], [ob, 0, 12_345]].sort()
      );
    });
  } finally {
    if (loanId) await cleanupLoan(loanId);
  }
});

test("issueStaffLoan rejects a missing source and leaves no loan behind", async () => {
  await inOrg(async () => {
    const { emp } = await fixtures();
    const before = (await db.select().from(loanLedger).where(eq(loanLedger.orgId, ORG))).length;
    await assert.rejects(
      issueStaffLoan({
        orgId: ORG, employeeId: emp.id, principalCents: 500, installmentCents: 100,
        type: "amortizing", kind: "advance", disbursedFrom: 0 as unknown as number, memoVerb: "Test advance",
      }),
      /Choose the account/
    );
    await assert.rejects(
      issueStaffLoan({
        orgId: ORG, employeeId: emp.id, principalCents: 500, installmentCents: 100,
        type: "amortizing", kind: "advance", disbursedFrom: 999_999_999, memoVerb: "Test advance",
      }),
      /Bank\/M-Pesa account not found/
    );
    const after = (await db.select().from(loanLedger).where(eq(loanLedger.orgId, ORG))).length;
    assert.equal(after, before, "failed issue must not leave a loan row");
  });
});

test("recordMissingLoanDisbursement backfills a bank disbursement once, dated as given", async () => {
  let loanId: number | undefined;
  try {
    await inOrg(async () => {
      const { emp, bank } = await fixtures();
      // A legacy loan issued with "don't record the disbursement", already repaid.
      const [legacy] = await db.insert(loanLedger).values({
        orgId: ORG, employeeId: emp.id, principalCents: 7_000, balanceCents: 0, installmentCents: 7_000,
        type: "amortizing", kind: "advance", status: "paid", createdAt: new Date().toISOString(),
      }).returning();
      loanId = legacy.id;

      const entryId = await recordMissingLoanDisbursement({ orgId: ORG, loanId, disbursedFrom: bank.id, date: TODAY });
      const [loan] = await db.select().from(loanLedger).where(eq(loanLedger.id, loanId));
      assert.equal(loan.disbursementJournalEntryId, entryId);
      assert.equal(loan.disbursedFromBankAccountId, bank.id);

      const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, entryId));
      assert.equal(entry.date, TODAY);
      assert.equal(entry.sourceType, "salary_advance_disbursement");
      const ar = await acct("1200");
      assert.deepEqual(
        (await linesOf(entryId)).map((l) => [l.accountId, l.debitCents, l.creditCents]).sort(),
        [[ar, 7_000, 0], [bank.accountId, 0, 7_000]].sort()
      );
      const txns = await db.select().from(bankTransactions).where(eq(bankTransactions.journalEntryId, entryId));
      assert.equal(txns.length, 1);
      assert.equal(txns[0].amountCents, -7_000);

      await assert.rejects(
        recordMissingLoanDisbursement({ orgId: ORG, loanId, disbursedFrom: "brought_forward", date: TODAY }),
        /already recorded/
      );
    });
  } finally {
    if (loanId) await cleanupLoan(loanId);
  }
});
