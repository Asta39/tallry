/**
 * Integration tests for business borrowings (external loans) and their
 * principal/interest repayments. Runs against the live database inside
 * org 1's context (same convention as ledger.test.ts); every row written
 * here is deleted in a finally block.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { orgContext } from "../org";
import { acct } from "../posting";
import { createExternalLoan, recordExternalLoanRepayment, externalLoanOutstanding, parseReceiptSource } from "../external-loans";
import { db, externalLoans, externalLoanRepayments, journalEntries, journalLines, bankAccounts, bankTransactions } from "@/db";
import { and, eq } from "drizzle-orm";

const ORG = 1;
const TODAY = new Date().toISOString().slice(0, 10);

function inOrg<T>(fn: () => Promise<T>): Promise<T> {
  return orgContext.run(ORG, fn);
}

async function deleteEntry(entryId: number) {
  await db.delete(bankTransactions).where(eq(bankTransactions.journalEntryId, entryId));
  await db.delete(journalLines).where(eq(journalLines.entryId, entryId));
  await db.delete(journalEntries).where(eq(journalEntries.id, entryId));
}

async function cleanupLoan(loanId: number) {
  const reps = await db.select().from(externalLoanRepayments).where(eq(externalLoanRepayments.loanId, loanId));
  await db.delete(externalLoanRepayments).where(eq(externalLoanRepayments.loanId, loanId));
  for (const r of reps) await deleteEntry(r.journalEntryId);
  const [loan] = await db.select().from(externalLoans).where(eq(externalLoans.id, loanId));
  await db.delete(externalLoans).where(eq(externalLoans.id, loanId));
  if (loan?.receiptJournalEntryId) await deleteEntry(loan.receiptJournalEntryId);
}

async function bank() {
  const [b] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, ORG), eq(bankAccounts.archived, false))).limit(1);
  assert.ok(b, "org 1 needs a bank account");
  return b;
}

const shape = (lines: { accountId: number; debitCents: number; creditCents: number }[]) =>
  lines.map((l) => [l.accountId, l.debitCents, l.creditCents]).sort();

test("parseReceiptSource accepts an account id or already_recorded only", () => {
  assert.equal(parseReceiptSource("already_recorded"), "already_recorded");
  assert.equal(parseReceiptSource("7"), 7);
  assert.equal(parseReceiptSource(""), null);
  assert.equal(parseReceiptSource("x"), null);
});

test("loan received into a bank posts DR bank / CR loan account; repayment splits principal and interest", async () => {
  let loanId: number | undefined;
  try {
    await inOrg(async () => {
      const b = await bank();
      const loanAcc = await acct("2400");
      const interestAcc = await acct("6075");
      loanId = await createExternalLoan({
        orgId: ORG, lender: "Test Bank", liabilityAccountId: loanAcc, interestAccountId: interestAcc,
        principalCents: 100_000, startDate: TODAY, receivedInto: b.id,
      });
      const [loan] = await db.select().from(externalLoans).where(eq(externalLoans.id, loanId));
      assert.ok(loan.receiptJournalEntryId);
      assert.deepEqual(
        shape(await db.select().from(journalLines).where(eq(journalLines.entryId, loan.receiptJournalEntryId!))),
        shape([{ accountId: b.accountId, debitCents: 100_000, creditCents: 0 }, { accountId: loanAcc, debitCents: 0, creditCents: 100_000 }])
      );
      const inflow = await db.select().from(bankTransactions).where(eq(bankTransactions.journalEntryId, loan.receiptJournalEntryId!));
      assert.equal(inflow[0]?.amountCents, 100_000);

      const repayEntry = await recordExternalLoanRepayment({
        orgId: ORG, loanId, date: TODAY, principalCents: 30_000, interestCents: 2_500, bankAccountId: b.id, reference: "T1",
      });
      assert.deepEqual(
        shape(await db.select().from(journalLines).where(eq(journalLines.entryId, repayEntry))),
        shape([
          { accountId: loanAcc, debitCents: 30_000, creditCents: 0 },
          { accountId: interestAcc, debitCents: 2_500, creditCents: 0 },
          { accountId: b.accountId, debitCents: 0, creditCents: 32_500 },
        ])
      );
      const outflow = await db.select().from(bankTransactions).where(eq(bankTransactions.journalEntryId, repayEntry));
      assert.equal(outflow[0]?.amountCents, -32_500);
      assert.equal(await externalLoanOutstanding(ORG, loanId), 70_000);

      await assert.rejects(
        recordExternalLoanRepayment({ orgId: ORG, loanId, date: TODAY, principalCents: 70_001, interestCents: 0, bankAccountId: b.id }),
        /exceeds what's still owed/
      );
      await assert.rejects(
        recordExternalLoanRepayment({ orgId: ORG, loanId, date: TODAY, principalCents: 0, interestCents: 0, bankAccountId: b.id }),
        /principal and\/or interest/
      );

      // Interest-only payment leaves the balance; final principal closes the loan.
      await recordExternalLoanRepayment({ orgId: ORG, loanId, date: TODAY, principalCents: 0, interestCents: 1_000, bankAccountId: b.id });
      assert.equal(await externalLoanOutstanding(ORG, loanId), 70_000);
      await recordExternalLoanRepayment({ orgId: ORG, loanId, date: TODAY, principalCents: 70_000, interestCents: 0, bankAccountId: b.id });
      const [closed] = await db.select().from(externalLoans).where(eq(externalLoans.id, loanId));
      assert.equal(closed.status, "closed");
    });
  } finally {
    if (loanId) await cleanupLoan(loanId);
  }
});

test("a loan already in the books registers without posting a receipt", async () => {
  let loanId: number | undefined;
  try {
    await inOrg(async () => {
      loanId = await createExternalLoan({
        orgId: ORG, lender: "Test SACCO", liabilityAccountId: await acct("2400"),
        principalCents: 50_000, startDate: TODAY, receivedInto: "already_recorded",
      });
      const [loan] = await db.select().from(externalLoans).where(eq(externalLoans.id, loanId));
      assert.equal(loan.receiptJournalEntryId, null);
      assert.equal(loan.receivedIntoBankAccountId, null);
      assert.equal(await externalLoanOutstanding(ORG, loanId), 50_000);
    });
  } finally {
    if (loanId) await cleanupLoan(loanId);
  }
});

test("createExternalLoan rejects a non-liability loan account and an interest charge with no account", async () => {
  await inOrg(async () => {
    await assert.rejects(
      createExternalLoan({ orgId: ORG, lender: "X", liabilityAccountId: await acct("6075"), principalCents: 1_000, startDate: TODAY, receivedInto: "already_recorded" }),
      /liability account/
    );
    let loanId: number | undefined;
    try {
      loanId = await createExternalLoan({ orgId: ORG, lender: "Test no-interest-acct", liabilityAccountId: await acct("2400"), principalCents: 1_000, startDate: TODAY, receivedInto: "already_recorded" });
      await assert.rejects(
        recordExternalLoanRepayment({ orgId: ORG, loanId, date: TODAY, principalCents: 0, interestCents: 100, bankAccountId: (await bank()).id }),
        /expense account for the interest/
      );
    } finally {
      if (loanId) await cleanupLoan(loanId);
    }
  });
});
