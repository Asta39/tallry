import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { profitAndLoss } from "@/lib/reports";
import { fmtKES } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { PeriodPicker, periodFromSearch, CsvLink, PdfLinks } from "@/components/reportShared";
import { ReportChart } from "@/components/ReportCharts";

export const dynamic = "force-dynamic";

export default async function PnlPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePerm("reports");
  const { from, to } = periodFromSearch(await searchParams);
  const pl = await withOrg(() => profitAndLoss(from, to));

  const Section = ({ title, rows, total }: { title: string; rows: typeof pl.income; total: number }) => (
    <>
      <tr className="hairline-t bg-[var(--color-ink-50)]/60">
        <Td className="font-semibold">{title}</Td>
        <Td right />
      </tr>
      {rows.map((r) => (
        <tr key={r.accountId} className="hairline-t">
          <Td className="pl-8">{r.name}</Td>
          <Td right>{fmtKES(r.balanceCents)}</Td>
        </tr>
      ))}
      <tr className="hairline-t">
        <Td className="font-semibold pl-8">Total {title.toLowerCase()}</Td>
        <Td right className="font-semibold">{fmtKES(total)}</Td>
      </tr>
    </>
  );

  return (
    <>
      <PageHeader title="Profit & Loss" subtitle={`${from} → ${to}`} />
      <PeriodPicker from={from} to={to} extra={
        <div className="flex gap-2">
          <CsvLink report="pnl" from={from} to={to} />
          <PdfLinks report="pnl" from={from} to={to} />
        </div>
      } />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ReportChart
          title="Income vs cost vs expenses"
          kind="bar"
          data={[
            { name: "Income", value: pl.totalIncome / 100 },
            { name: "COGS", value: pl.totalCogs / 100 },
            { name: "Expenses", value: pl.totalExpenses / 100 },
            { name: "Net profit", value: pl.netProfit / 100 },
          ]}
        />
        <ReportChart
          title="Expense breakdown"
          kind="pie"
          data={pl.expenses
            .filter((e) => e.balanceCents > 0)
            .sort((a, b) => b.balanceCents - a.balanceCents)
            .slice(0, 8)
            .map((e) => ({ name: e.name, value: e.balanceCents / 100 }))}
        />
      </div>

      <TableCard>
        <thead className="hairline-b">
          <tr><Th>Account</Th><Th right>Amount</Th></tr>
        </thead>
        <tbody>
          <Section title="Income" rows={pl.income} total={pl.totalIncome} />
          <Section title="Cost of goods sold" rows={pl.cogs} total={pl.totalCogs} />
          <tr className="hairline-t">
            <Td className="font-semibold">Gross profit</Td>
            <Td right className="font-semibold">{fmtKES(pl.grossProfit)}</Td>
          </tr>
          <Section title="Operating expenses" rows={pl.expenses} total={pl.totalExpenses} />
          <tr className="hairline-t bg-[var(--color-accent-50)]">
            <Td className="font-bold text-[14px]">Net profit</Td>
            <Td right className={`font-bold text-[14px] ${pl.netProfit >= 0 ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"}`}>
              {fmtKES(pl.netProfit)}
            </Td>
          </tr>
        </tbody>
      </TableCard>
    </>
  );
}
