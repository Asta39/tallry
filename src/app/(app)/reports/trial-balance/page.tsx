import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { accountBalances } from "@/lib/reports";
import { fmtKES } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { PeriodPicker, periodFromSearch, CsvLink, PdfLinks } from "@/components/reportShared";

export const dynamic = "force-dynamic";

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePerm("reports");
  const { from, to } = periodFromSearch(await searchParams);
  const balances = (await withOrg(() => accountBalances({ to }))).filter((r) => r.debitCents || r.creditCents);
  // A trial balance shows each account's NET balance in one column (its
  // normal side), not the raw gross debit/credit sums — debitCents/
  // creditCents are cumulative totals of every debit-side and credit-side
  // posting ever made to that account, so an active account is virtually
  // always nonzero in both. Worse, postEntry() rejects any unbalanced entry
  // before it's ever written, so sum(debitCents) === sum(creditCents) for
  // every org, always — the raw totals can never actually go "out of
  // balance" no matter what's wrong elsewhere, defeating the one report
  // whose entire job is to be that check. Derive Dr/Cr from the signed
  // balanceCents (already computed per the account's normal side) instead.
  const rows = balances.map((r) => {
    const debitNature = r.type === "asset" || r.type === "expense";
    const netDebit = debitNature ? Math.max(r.balanceCents, 0) : Math.max(-r.balanceCents, 0);
    const netCredit = debitNature ? Math.max(-r.balanceCents, 0) : Math.max(r.balanceCents, 0);
    return { ...r, netDebit, netCredit };
  });
  const totalDr = rows.reduce((s, r) => s + r.netDebit, 0);
  const totalCr = rows.reduce((s, r) => s + r.netCredit, 0);

  return (
    <>
      <PageHeader title="Trial Balance" subtitle={`All activity through ${to}`} />
      <PeriodPicker from={from} to={to} extra={
        <div className="flex gap-2">
          <CsvLink report="trial-balance" from={from} to={to} />
          <PdfLinks report="trial-balance" from={from} to={to} />
        </div>
      } />
      <TableCard>
        <thead className="hairline-b">
          <tr><Th>Code</Th><Th>Account</Th><Th right>Debits</Th><Th right>Credits</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accountId} className="hairline-t">
              <Td className="tnum text-[var(--color-ink-400)]">{r.code}</Td>
              <Td>{r.name}</Td>
              <Td right>{r.netDebit ? fmtKES(r.netDebit) : "—"}</Td>
              <Td right>{r.netCredit ? fmtKES(r.netCredit) : "—"}</Td>
            </tr>
          ))}
          <tr className={`hairline-t font-bold ${totalDr === totalCr ? "bg-[var(--color-accent-50)]" : "bg-red-50"}`}>
            <Td /><Td>{totalDr === totalCr ? "Balanced ✓" : "OUT OF BALANCE"}</Td>
            <Td right>{fmtKES(totalDr)}</Td>
            <Td right>{fmtKES(totalCr)}</Td>
          </tr>
        </tbody>
      </TableCard>
    </>
  );
}
