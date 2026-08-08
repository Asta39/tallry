import { db, accounts, documents, documentLines, journalEntries, journalLines, payments, expenseClaims, bankAccounts, bankTransactions, org, ledgerIntegrityFindings } from "@/db";
import { and, eq, inArray, ne, isNull, notInArray, sql } from "drizzle-orm";
import { fmtKES } from "@/lib/money";

export type IntegrityFinding = {
  checkKey: string;
  severity: "error" | "warning";
  message: string;
  detail?: string;
};

/** Runs every ledger-integrity check against one org's live data. Pure and
 *  read-only — writing findings to the DB is the cron route's job, not this
 *  function's, so it can also be called on demand (e.g. a future "audit this
 *  org now" admin button) without touching the findings table. Each check
 *  here is one the accountant-reported bugs this session had to be found by
 *  hand — trial balance, unbalanced entries, docs missing their journal
 *  entry, AR/AP/Reimbursements-Payable vs source-document totals, orphaned
 *  reversals, overpaid documents, payments missing a journal entry. */
export async function runOrgIntegrityChecks(orgId: number): Promise<IntegrityFinding[]> {
  const findings: IntegrityFinding[] = [];

  // 1. Global trial balance — every debit must equal every credit, org-wide.
  const [tb] = await db.select({
    d: sql<string>`coalesce(sum(${journalLines.debitCents}), 0)`,
    c: sql<string>`coalesce(sum(${journalLines.creditCents}), 0)`,
  }).from(journalLines).where(eq(journalLines.orgId, orgId));
  const tbDiff = Number(tb.d) - Number(tb.c);
  if (tbDiff !== 0) {
    findings.push({
      checkKey: "trial_balance",
      severity: "error",
      message: `Trial balance is off by ${fmtKES(Math.abs(tbDiff))} (debits ${tbDiff > 0 ? "exceed" : "fall short of"} credits)`,
      detail: `Total debits ${fmtKES(Number(tb.d))}, total credits ${fmtKES(Number(tb.c))}`,
    });
  }

  // 2. Any individual journal entry whose own lines don't balance.
  const unbalanced = await db.select({
    entryId: journalLines.entryId,
    d: sql<string>`sum(${journalLines.debitCents})`,
    c: sql<string>`sum(${journalLines.creditCents})`,
  }).from(journalLines).where(eq(journalLines.orgId, orgId))
    .groupBy(journalLines.entryId)
    .having(sql`sum(${journalLines.debitCents}) != sum(${journalLines.creditCents})`);
  if (unbalanced.length > 0) {
    findings.push({
      checkKey: "unbalanced_entries",
      severity: "error",
      message: `${unbalanced.length} journal entr${unbalanced.length === 1 ? "y" : "ies"} where debits don't equal credits`,
      detail: `Entry ids: ${unbalanced.slice(0, 20).map((r) => r.entryId).join(", ")}`,
    });
  }

  // 3. Posted documents (issued, not pending/draft/void) missing their journal entry.
  const missingJE = await db.select({ id: documents.id, type: documents.type, number: documents.number })
    .from(documents)
    .where(and(
      eq(documents.orgId, orgId),
      inArray(documents.type, ["invoice", "bill", "expense", "credit_note"]),
      ne(documents.status, "draft"),
      ne(documents.status, "void"),
      ne(documents.status, "pending_approval"),
      isNull(documents.journalEntryId),
    ));
  if (missingJE.length > 0) {
    findings.push({
      checkKey: "documents_missing_journal_entry",
      severity: "error",
      message: `${missingJE.length} posted document(s) have no journal entry`,
      detail: missingJE.slice(0, 20).map((d) => `${d.type} ${d.number}`).join(", "),
    });
  }

  // 4. Payments (recorded receipts/payouts) missing their journal entry.
  const payNoJE = await db.select({ id: payments.id, number: payments.number })
    .from(payments)
    .where(and(eq(payments.orgId, orgId), isNull(payments.journalEntryId)));
  if (payNoJE.length > 0) {
    findings.push({
      checkKey: "payments_missing_journal_entry",
      severity: "error",
      message: `${payNoJE.length} payment(s) have no journal entry`,
      detail: payNoJE.slice(0, 20).map((p) => p.number).join(", "),
    });
  }

  // 5. AR ledger balance vs sum of open invoice balances.
  const arDiff = await ledgerVsDocuments(orgId, "1200", "invoice", "asset");
  if (arDiff) findings.push(arDiff);

  // 6. AP ledger balance vs sum of open bill balances.
  const apDiff = await ledgerVsDocuments(orgId, "2100", "bill", "liability");
  if (apDiff) findings.push(apDiff);

  // 7. Staff Reimbursements Payable vs sum of still-open expense claims.
  const [reimbAcct] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "2340"))).limit(1);
  if (reimbAcct) {
    const [reimbBal] = await db.select({ bal: sql<string>`coalesce(sum(${journalLines.creditCents} - ${journalLines.debitCents}), 0)` })
      .from(journalLines).where(and(eq(journalLines.orgId, orgId), eq(journalLines.accountId, reimbAcct.id)));
    const [claimBal] = await db.select({ bal: sql<string>`coalesce(sum(${expenseClaims.amountCents}), 0)` })
      .from(expenseClaims).where(and(eq(expenseClaims.orgId, orgId), inArray(expenseClaims.status, ["pending", "approved", "approving", "paying"])));
    const diff = Number(reimbBal.bal) - Number(claimBal.bal);
    if (diff !== 0) {
      findings.push({
        checkKey: "reimbursements_payable_mismatch",
        severity: "error",
        message: `Staff Reimbursements Payable is off by ${fmtKES(Math.abs(diff))} against open expense claims`,
        detail: `Ledger balance ${fmtKES(Number(reimbBal.bal))}, open claims total ${fmtKES(Number(claimBal.bal))}`,
      });
    }
  }

  // (No separate per-claim "posted to the wrong account" check: an earlier
  // version of this checked each claim's OWN accrual entry for a stray AP
  // line, but that produces a false positive on every claim that's already
  // been correctly fixed by a reclass entry — the append-only ledger means
  // the original (now-superseded) entry still legitimately references AP
  // forever. Check #7's aggregate 2340-vs-open-claims comparison already
  // catches real drift without that false-positive risk.)

  // 9. Documents overpaid/overcredited past their own total.
  const overpaid = await db.select({ id: documents.id, type: documents.type, number: documents.number })
    .from(documents)
    .where(and(
      eq(documents.orgId, orgId),
      sql`${documents.paidCents} + coalesce(${documents.creditedCents}, 0) > ${documents.totalCents}`,
    ));
  if (overpaid.length > 0) {
    findings.push({
      checkKey: "documents_overpaid",
      severity: "warning",
      message: `${overpaid.length} document(s) show paid+credited exceeding their total`,
      detail: overpaid.slice(0, 20).map((d) => `${d.type} ${d.number}`).join(", "),
    });
  }

  // 10. Reversal entries pointing at a journal entry that doesn't exist for this org.
  const entries = await db.select({ id: journalEntries.id, reversalOfId: journalEntries.reversalOfId })
    .from(journalEntries).where(and(eq(journalEntries.orgId, orgId), sql`${journalEntries.reversalOfId} is not null`));
  if (entries.length > 0) {
    const targetIds = entries.map((e) => e.reversalOfId!).filter(Boolean);
    const existing = await db.select({ id: journalEntries.id }).from(journalEntries).where(and(eq(journalEntries.orgId, orgId), inArray(journalEntries.id, targetIds)));
    const existingSet = new Set(existing.map((e) => e.id));
    const orphaned = entries.filter((e) => e.reversalOfId && !existingSet.has(e.reversalOfId));
    if (orphaned.length > 0) {
      findings.push({
        checkKey: "orphaned_reversals",
        severity: "warning",
        message: `${orphaned.length} reversal entr${orphaned.length === 1 ? "y points" : "ies point"} at a journal entry that no longer exists`,
        detail: `Entry ids: ${orphaned.map((e) => e.id).join(", ")}`,
      });
    }
  }

  // 11. Bank account ledger balance vs mirrored register transactions.
  // Verified against live data before shipping this check: bank_accounts.
  // openingBalanceCents is NOT itself posted as a journal entry — it's only
  // a reconciliation-math input (see getReconciliationState) — so the GL
  // account balance equals the mirrored bank_transactions sum alone. Adding
  // openingBalanceCents here (an earlier draft of this check did) produced a
  // false positive on every account with a nonzero opening balance.
  const banks = await db.select({ id: bankAccounts.id, name: bankAccounts.name, accountId: bankAccounts.accountId })
    .from(bankAccounts).where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.archived, false)));
  for (const bank of banks) {
    const [ledgerBal] = await db.select({ bal: sql<string>`coalesce(sum(${journalLines.debitCents} - ${journalLines.creditCents}), 0)` })
      .from(journalLines).where(and(eq(journalLines.orgId, orgId), eq(journalLines.accountId, bank.accountId)));
    const [txnSum] = await db.select({ sum: sql<string>`coalesce(sum(${bankTransactions.amountCents}), 0)` })
      .from(bankTransactions).where(and(eq(bankTransactions.orgId, orgId), eq(bankTransactions.bankAccountId, bank.id)));
    const expected = Number(txnSum.sum);
    const diff = Number(ledgerBal.bal) - expected;
    // A gap here means the ledger (source of truth for the account balance)
    // and the bank register (source of truth for reconciliation) disagree —
    // small unmirrored entries are the usual cause, worth a warning not an
    // error since it doesn't necessarily mean money is unaccounted for.
    if (Math.abs(diff) >= 100) {
      findings.push({
        checkKey: `bank_register_mismatch_${bank.id}`,
        severity: "warning",
        message: `"${bank.name}" ledger balance doesn't match its mirrored bank register by ${fmtKES(Math.abs(diff))}`,
        detail: `Ledger ${fmtKES(Number(ledgerBal.bal))}, register total ${fmtKES(expected)}`,
      });
    }
  }

  return findings;
}

/** Runs every org's checks and upserts findings — shared by the daily cron
 *  route and the admin's on-demand "Run now" button, so they can never
 *  drift out of sync with each other. */
export async function runAndStoreAllOrgChecks(): Promise<{ orgsChecked: number; totalFindings: number }> {
  const orgs = await db.select({ id: org.id }).from(org);
  const now = new Date().toISOString();
  let totalFindings = 0;

  for (const o of orgs) {
    const findings = await runOrgIntegrityChecks(o.id);
    totalFindings += findings.length;
    const seenKeys = findings.map((f) => f.checkKey);

    for (const f of findings) {
      await db.insert(ledgerIntegrityFindings).values({
        orgId: o.id,
        checkKey: f.checkKey,
        severity: f.severity,
        message: f.message,
        detail: f.detail,
        firstSeenAt: now,
        lastSeenAt: now,
        resolvedAt: null,
      }).onConflictDoUpdate({
        target: [ledgerIntegrityFindings.orgId, ledgerIntegrityFindings.checkKey],
        set: { severity: f.severity, message: f.message, detail: f.detail, lastSeenAt: now, resolvedAt: null },
      });
    }

    const staleConditions = [eq(ledgerIntegrityFindings.orgId, o.id), isNull(ledgerIntegrityFindings.resolvedAt)];
    if (seenKeys.length > 0) staleConditions.push(notInArray(ledgerIntegrityFindings.checkKey, seenKeys));
    await db.update(ledgerIntegrityFindings).set({ resolvedAt: now }).where(and(...staleConditions));
  }

  return { orgsChecked: orgs.length, totalFindings };
}

async function ledgerVsDocuments(
  orgId: number,
  accountCode: string,
  docType: "invoice" | "bill",
  side: "asset" | "liability"
): Promise<IntegrityFinding | null> {
  const [acct] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, accountCode))).limit(1);
  if (!acct) return null;

  const balExpr = side === "asset"
    ? sql<string>`coalesce(sum(${journalLines.debitCents} - ${journalLines.creditCents}), 0)`
    : sql<string>`coalesce(sum(${journalLines.creditCents} - ${journalLines.debitCents}), 0)`;
  const [ledgerBal] = await db.select({ bal: balExpr }).from(journalLines).where(and(eq(journalLines.orgId, orgId), eq(journalLines.accountId, acct.id)));

  const excludeStatuses = docType === "bill" ? ["draft", "void", "pending_approval"] : ["draft", "void"];
  const docRows = await db.select({ totalCents: documents.totalCents, paidCents: documents.paidCents, creditedCents: documents.creditedCents })
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.type, docType), sql`${documents.status} not in (${sql.join(excludeStatuses.map((s) => sql`${s}`), sql`, `)})`));
  const docBal = docRows.reduce((s, d) => s + (d.totalCents - d.paidCents - (d.creditedCents || 0)), 0);

  const diff = Number(ledgerBal.bal) - docBal;
  if (diff === 0) return null;
  const label = docType === "invoice" ? "Accounts Receivable" : "Accounts Payable";
  return {
    checkKey: `${docType}_ledger_mismatch`,
    severity: "error",
    message: `${label} ledger balance is off by ${fmtKES(Math.abs(diff))} against open ${docType}s`,
    detail: `Ledger balance ${fmtKES(Number(ledgerBal.bal))}, open ${docType} total ${fmtKES(docBal)}`,
  };
}
