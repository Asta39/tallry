import { db, bankAccounts, bankReconciliations, org as orgTable } from "@/db";
import { and, eq, inArray, desc } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { endOfMonthISO } from "@/lib/recurring";

export interface AccountReconciledStatus {
  id: number;
  name: string;
  kind: string;
  /** Latest statement date this account has a *completed* reconciliation
   *  for, or null if it has never been reconciled at all. */
  reconciledThrough: string | null;
}

/** Every active bank/M-Pesa account (cash/card excluded — nothing external
 *  to reconcile against) with how far its own reconciliation has gotten.
 *  Shared by the period-lock page (so it's obvious why auto-lock hasn't
 *  fired yet) and getReconciledThroughDate below. */
export async function getAccountReconciledStatuses(orgId: number): Promise<AccountReconciledStatus[]> {
  const accounts = await db
    .select({ id: bankAccounts.id, name: bankAccounts.name, kind: bankAccounts.kind })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.archived, false), inArray(bankAccounts.kind, ["bank", "mpesa"])));

  const out: AccountReconciledStatus[] = [];
  for (const acct of accounts) {
    const [latest] = await db
      .select({ statementDate: bankReconciliations.statementDate })
      .from(bankReconciliations)
      .where(and(
        eq(bankReconciliations.orgId, orgId),
        eq(bankReconciliations.bankAccountId, acct.id),
        eq(bankReconciliations.status, "completed"),
      ))
      .orderBy(desc(bankReconciliations.statementDate))
      .limit(1);
    out.push({ ...acct, reconciledThrough: latest?.statementDate ?? null });
  }
  return out;
}

/** The org-wide "fully reconciled through" date — the *minimum* across every
 *  active bank/M-Pesa account's own latest completed reconciliation (the
 *  weakest link decides how far the whole org can be considered reconciled).
 *  Null if any active account has never completed one. */
export async function getReconciledThroughDate(orgId: number): Promise<string | null> {
  const statuses = await getAccountReconciledStatuses(orgId);
  if (statuses.length === 0) return null;
  let min: string | null = null;
  for (const s of statuses) {
    if (!s.reconciledThrough) return null;
    if (min === null || s.reconciledThrough < min) min = s.reconciledThrough;
  }
  return min;
}

/** The last day of the most recent calendar month that `reconciledThrough`
 *  covers *in full*. If the date isn't itself a month-end, only the
 *  previous month is fully covered — e.g. reconciled through Sept 15 means
 *  August is locked, not September. */
function latestFullyReconciledMonthEnd(reconciledThrough: string): string {
  const thisMonthEnd = endOfMonthISO(reconciledThrough);
  if (reconciledThrough >= thisMonthEnd) return thisMonthEnd;
  const [y, m] = reconciledThrough.split("-").map(Number);
  const prevMonthLastDay = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  return endOfMonthISO(prevMonthLastDay);
}

/** Called after a reconciliation completes (see completeReconciliation in
 *  phase-a-actions.ts). No-op unless the org opted in via
 *  autoLockOnReconciliation, and forward-only — this never moves lockDate
 *  earlier than it already is, only ever advances it. */
export async function maybeAutoLockPeriod(orgId: number): Promise<void> {
  const [o] = await db
    .select({ autoLockOnReconciliation: orgTable.autoLockOnReconciliation, lockDate: orgTable.lockDate })
    .from(orgTable)
    .where(eq(orgTable.id, orgId))
    .limit(1);
  if (!o?.autoLockOnReconciliation) return;

  const reconciledThrough = await getReconciledThroughDate(orgId);
  if (!reconciledThrough) return;

  const candidateLock = latestFullyReconciledMonthEnd(reconciledThrough);
  if (o.lockDate && candidateLock <= o.lockDate) return;

  await db.update(orgTable).set({ lockDate: candidateLock }).where(eq(orgTable.id, orgId));
  await logAudit({
    action: "auto_lock",
    module: "period_lock",
    detail: `Auto-locked through ${candidateLock} — every active bank/M-Pesa account is reconciled through this month`,
  });
}
