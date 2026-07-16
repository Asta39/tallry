import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { generalLedger, accountOpeningBalance, accountBalances } from "@/lib/reports";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { PeriodPicker, periodFromSearch, PdfLinks } from "@/components/reportShared";
import { db, accounts } from "@/db";
import { eq } from "drizzle-orm";
import { getOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; accountId?: string }>;
}) {
  await requirePerm("reports");
  const o = await getOrg();
  const sp = await searchParams;
  const { from, to } = periodFromSearch(sp);
  const accountId = sp.accountId;

  const allAccounts = await db.select().from(accounts).where(eq(accounts.orgId, o.id));

  let rows: Awaited<ReturnType<typeof generalLedger>> = [];
  let totalDr = 0;
  let totalCr = 0;
  let opening = { balanceCents: 0, debitNature: true };
  let running: number[] = [];

  if (accountId) {
    [rows, opening] = await withOrg(() => Promise.all([
      generalLedger(Number(accountId), from, to),
      accountOpeningBalance(Number(accountId), from),
    ]));
    totalDr = rows.reduce((s, r) => s + r.debitCents, 0);
    totalCr = rows.reduce((s, r) => s + r.creditCents, 0);
    let bal = opening.balanceCents;
    running = rows.map((r) => {
      bal += opening.debitNature ? r.debitCents - r.creditCents : r.creditCents - r.debitCents;
      return bal;
    });
  }

  return (
    <>
      <PageHeader title="General Ledger" subtitle={`Detailed transaction history for an account`} />
      <form className="no-print flex items-center gap-2 mb-5 text-[13px]">
        <label className="text-[var(--color-ink-600)]">Account</label>
        <select name="accountId" defaultValue={accountId} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 bg-white" required>
          <option value="" disabled>Select account...</option>
          {allAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
          ))}
        </select>
        <label className="text-[var(--color-ink-600)] ml-2">From</label>
        <input type="date" name="from" defaultValue={from} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 bg-white" />
        <label className="text-[var(--color-ink-600)]">to</label>
        <input type="date" name="to" defaultValue={to} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 bg-white" />
        <button className="rounded-md bg-[var(--color-accent-500)] text-white font-medium px-3 py-1.5">Run</button>
        {accountId && <PdfLinks report="general-ledger" from={from} to={to} accountId={accountId} />}
      </form>

      {accountId ? (
        <TableCard>
          <thead className="hairline-b">
            <tr><Th>Date</Th><Th>Details</Th><Th right>Debit</Th><Th right>Credit</Th><Th right>Balance</Th></tr>
          </thead>
          <tbody>
            <tr className="hairline-t bg-[var(--color-ink-50)]/60">
              <Td /><Td className="italic text-[var(--color-ink-600)]">Opening balance</Td>
              <Td right /><Td right />
              <Td right className="italic text-[var(--color-ink-600)]">{fmtKES(opening.balanceCents)}</Td>
            </tr>
            {rows.map((r, i) => (
              <tr key={`${r.entryId}-${r.debitCents}-${r.creditCents}`} className="hairline-t">
                <Td className="whitespace-nowrap">{r.date}</Td>
                <Td>{r.memo || r.lineMemo || r.sourceType}</Td>
                <Td right>{r.debitCents > 0 ? fmtKES(r.debitCents) : "-"}</Td>
                <Td right>{r.creditCents > 0 ? fmtKES(r.creditCents) : "-"}</Td>
                <Td right>{fmtKES(running[i])}</Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="hairline-t">
                <td colSpan={5} className="text-center py-6 text-[var(--color-ink-400)]">
                  No transactions found in this period.
                </td>
              </tr>
            )}
            {rows.length > 0 && (
              <tr className="hairline-t bg-[var(--color-ink-50)]/60 font-bold">
                <Td /><Td>Period Movement</Td>
                <Td right>{fmtKES(totalDr)}</Td>
                <Td right>{fmtKES(totalCr)}</Td>
                <Td right>{fmtKES(running[running.length - 1])}</Td>
              </tr>
            )}
          </tbody>
        </TableCard>
      ) : (
        <div className="card p-8 text-center text-[var(--color-ink-400)]">
          Select an account above to view its general ledger.
        </div>
      )}
    </>
  );
}
