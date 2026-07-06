import { balanceSheet } from "@/lib/reports";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const sp = await searchParams;
  const asOf = sp.to || todayISO();
  const bs = await balanceSheet(asOf);

  const Rows = ({ rows }: { rows: typeof bs.assets }) => (
    <>
      {rows.map((r) => (
        <tr key={r.accountId} className="hairline-t">
          <Td className="pl-8">{r.name}</Td>
          <Td right>{fmtKES(r.balanceCents)}</Td>
        </tr>
      ))}
    </>
  );

  return (
    <>
      <PageHeader title="Balance Sheet" subtitle={`As of ${asOf}`} />
      <form className="no-print flex items-center gap-2 mb-5 text-[13px]">
        <label className="text-[var(--color-ink-600)]">As of</label>
        <input type="date" name="to" defaultValue={asOf} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 bg-white" />
        <button className="rounded-md bg-[var(--color-accent-500)] text-white font-medium px-3 py-1.5">Run</button>
      </form>
      <TableCard>
        <thead className="hairline-b"><tr><Th>Account</Th><Th right>Amount</Th></tr></thead>
        <tbody>
          <tr className="bg-[var(--color-ink-50)]/60"><Td className="font-semibold">What you own (Assets)</Td><Td right /></tr>
          <Rows rows={bs.assets} />
          <tr className="hairline-t"><Td className="font-semibold pl-8">Total assets</Td><Td right className="font-semibold">{fmtKES(bs.totalAssets)}</Td></tr>

          <tr className="hairline-t bg-[var(--color-ink-50)]/60"><Td className="font-semibold">What you owe (Liabilities)</Td><Td right /></tr>
          <Rows rows={bs.liabilities} />
          <tr className="hairline-t"><Td className="font-semibold pl-8">Total liabilities</Td><Td right className="font-semibold">{fmtKES(bs.totalLiabilities)}</Td></tr>

          <tr className="hairline-t bg-[var(--color-ink-50)]/60"><Td className="font-semibold">Owner&apos;s stake (Equity)</Td><Td right /></tr>
          <Rows rows={bs.equity} />
          <tr className="hairline-t"><Td className="pl-8">Current period earnings</Td><Td right>{fmtKES(bs.currentEarningsCents)}</Td></tr>
          <tr className="hairline-t"><Td className="font-semibold pl-8">Total equity</Td><Td right className="font-semibold">{fmtKES(bs.totalEquity)}</Td></tr>

          <tr className="hairline-t bg-[var(--color-accent-50)]">
            <Td className="font-bold">Liabilities + Equity</Td>
            <Td right className="font-bold">{fmtKES(bs.totalLiabilities + bs.totalEquity)}</Td>
          </tr>
        </tbody>
      </TableCard>
      {bs.totalAssets !== bs.totalLiabilities + bs.totalEquity && (
        <p className="mt-3 text-[13px] text-[var(--color-bad)]">
          ⚠︎ Sheet is out of balance — check opening balances.
        </p>
      )}
    </>
  );
}
