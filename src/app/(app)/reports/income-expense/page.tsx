import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { monthlyIncomeExpense } from "@/lib/reports";
import { listCostCenters } from "@/lib/cost-centers";
import { fmtKES } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { PdfLinks, LocationGate } from "@/components/reportShared";

export const dynamic = "force-dynamic";

export default async function IncomeExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ costCenter?: string }>;
}) {
  await requirePerm("reports");
  const { costCenter } = await searchParams;
  const costCenters = await withOrg(() => listCostCenters(true));

  if (!costCenter) {
    return (
      <>
        <PageHeader title="Income vs Expense" subtitle="Pick a location before viewing this report" />
        <LocationGate costCenters={costCenters} />
      </>
    );
  }
  const costCenterId = costCenter === "all" ? undefined : Number(costCenter);
  const locationName = costCenterId ? costCenters.find((c) => c.id === costCenterId)?.name ?? "Unknown location" : "All locations";

  // Last 12 months
  const rows = await withOrg(() => monthlyIncomeExpense(12, costCenterId));

  return (
    <>
      <div className="flex items-start justify-between">
        <PageHeader title="Income vs Expense" subtitle={`Monthly breakdown over the last 12 months · ${locationName} · Expense is operating costs only, excludes COGS/inventory adjustments (see Profit & Loss for those)`} />
        <div className="mt-2 flex gap-2">
          <a href="/reports/income-expense" className="rounded-md border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--color-ink-50)]">Change location</a>
          <PdfLinks report="income-expense" />
        </div>
      </div>
      <TableCard>
        <thead className="hairline-b">
          <tr><Th>Month</Th><Th right>Income</Th><Th right>Expense</Th><Th right>Net</Th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const net = r.incomeCents - r.expenseCents;
            return (
              <tr key={r.month} className="hairline-t">
                <Td className="font-medium">{r.label}</Td>
                <Td right className="text-[var(--color-good)]">{fmtKES(r.incomeCents)}</Td>
                <Td right className="text-[var(--color-bad)]">{fmtKES(r.expenseCents)}</Td>
                <Td right className={`font-semibold ${net >= 0 ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"}`}>
                  {fmtKES(net)}
                </Td>
              </tr>
            );
          })}
          {(() => {
            const totalIncome = rows.reduce((s, r) => s + r.incomeCents, 0);
            const totalExpense = rows.reduce((s, r) => s + r.expenseCents, 0);
            const totalNet = totalIncome - totalExpense;
            return (
              <tr className="hairline-t bg-[var(--color-ink-50)]">
                <Td className="font-semibold">Total ({rows.length} months)</Td>
                <Td right className="font-semibold text-[var(--color-good)]">{fmtKES(totalIncome)}</Td>
                <Td right className="font-semibold text-[var(--color-bad)]">{fmtKES(totalExpense)}</Td>
                <Td right className={`font-bold ${totalNet >= 0 ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"}`}>
                  {fmtKES(totalNet)}
                </Td>
              </tr>
            );
          })()}
        </tbody>
      </TableCard>
    </>
  );
}
