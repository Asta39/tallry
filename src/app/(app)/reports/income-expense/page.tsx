import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { monthlyIncomeExpense } from "@/lib/reports";
import { fmtKES } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { PdfLinks } from "@/components/reportShared";

export const dynamic = "force-dynamic";

export default async function IncomeExpensePage() {
  await requirePerm("reports");
  
  // Last 12 months
  const rows = await withOrg(() => monthlyIncomeExpense(12));

  return (
    <>
      <div className="flex items-start justify-between">
        <PageHeader title="Income vs Expense" subtitle="Monthly breakdown over the last 12 months" />
        <div className="mt-2 flex gap-2">
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
        </tbody>
      </TableCard>
    </>
  );
}
