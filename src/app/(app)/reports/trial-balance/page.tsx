import { accountBalances } from "@/lib/reports";
import { fmtKES } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { PeriodPicker, periodFromSearch, CsvLink } from "@/components/reportShared";

export const dynamic = "force-dynamic";

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = periodFromSearch(await searchParams);
  const rows = (await accountBalances({ to })).filter((r) => r.debitCents || r.creditCents);
  const totalDr = rows.reduce((s, r) => s + r.debitCents, 0);
  const totalCr = rows.reduce((s, r) => s + r.creditCents, 0);

  return (
    <>
      <PageHeader title="Trial Balance" subtitle={`All activity through ${to}`} />
      <PeriodPicker from={from} to={to} extra={<CsvLink report="trial-balance" from={from} to={to} />} />
      <TableCard>
        <thead className="hairline-b">
          <tr><Th>Code</Th><Th>Account</Th><Th right>Debits</Th><Th right>Credits</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accountId} className="hairline-t">
              <Td className="tnum text-[var(--color-ink-400)]">{r.code}</Td>
              <Td>{r.name}</Td>
              <Td right>{fmtKES(r.debitCents)}</Td>
              <Td right>{fmtKES(r.creditCents)}</Td>
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
