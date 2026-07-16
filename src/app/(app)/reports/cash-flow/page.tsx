import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { cashFlowStatement } from "@/lib/reports";
import { fmtKES } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { PeriodPicker, periodFromSearch, PdfLinks } from "@/components/reportShared";

export const dynamic = "force-dynamic";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePerm("reports");
  const sp = await searchParams;
  const { from, to } = periodFromSearch(sp);
  const cf = await withOrg(() => cashFlowStatement(from, to));

  const Rows = ({ title, amount }: { title: string; amount: number }) => (
    <tr className="hairline-t">
      <Td className="pl-8">{title}</Td>
      <Td right className={amount < 0 ? "text-[var(--color-bad)]" : ""}>{fmtKES(amount)}</Td>
    </tr>
  );

  return (
    <>
      <PageHeader title="Cash Flow Statement" subtitle={`${from} to ${to}`} />
      <PeriodPicker from={from} to={to} extra={<PdfLinks report="cash-flow" from={from} to={to} />} />
      <TableCard>
        <thead className="hairline-b"><tr><Th>Activity</Th><Th right>Amount</Th></tr></thead>
        <tbody>
          <tr className="bg-[var(--color-ink-50)]/60"><Td className="font-semibold">Operating Activities</Td><Td right /></tr>
          <Rows title="Net Income / Operations" amount={cf.netOp} />
          <tr className="hairline-t"><Td className="font-semibold pl-8">Net Cash from Operating Activities</Td><Td right className="font-semibold">{fmtKES(cf.netOp)}</Td></tr>

          <tr className="hairline-t bg-[var(--color-ink-50)]/60"><Td className="font-semibold">Investing Activities</Td><Td right /></tr>
          <Rows title="Fixed Assets" amount={cf.netInv} />
          <tr className="hairline-t"><Td className="font-semibold pl-8">Net Cash from Investing Activities</Td><Td right className="font-semibold">{fmtKES(cf.netInv)}</Td></tr>

          <tr className="hairline-t bg-[var(--color-ink-50)]/60"><Td className="font-semibold">Financing Activities</Td><Td right /></tr>
          <Rows title="Equity & Long-term Liabilities" amount={cf.netFin} />
          <tr className="hairline-t"><Td className="font-semibold pl-8">Net Cash from Financing Activities</Td><Td right className="font-semibold">{fmtKES(cf.netFin)}</Td></tr>

          <tr className="hairline-t bg-[var(--color-accent-50)]">
            <Td className="font-bold">Net Change in Cash (bank/cash ledger movement)</Td>
            <Td right className={`font-bold ${cf.netChangeActual < 0 ? "text-[var(--color-bad)]" : ""}`}>{fmtKES(cf.netChangeActual)}</Td>
          </tr>
        </tbody>
      </TableCard>
      {cf.netChangeComputed !== cf.netChangeActual && (
        <p className="mt-3 text-[13px] text-[var(--color-warn)]">
          ⚠︎ The categorized Operating/Investing/Financing split ({fmtKES(cf.netChangeComputed)}) doesn&apos;t match the
          actual bank/cash movement for this period ({fmtKES(cf.netChangeActual)}) — likely unpaid invoices/bills
          (working-capital timing) not reflected in this simplified statement. The figure above is the real cash movement.
        </p>
      )}
    </>
  );
}
