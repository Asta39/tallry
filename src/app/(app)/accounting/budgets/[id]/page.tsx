import { requirePerm } from "@/lib/guard";
import { getBudget, listBudgetableAccounts, getBudgetVsActual, deleteBudgetAction } from "@/lib/budgets";
import { PageHeader } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import { notFound } from "next/navigation";
import { BudgetGrid } from "./BudgetGrid";
import { DeleteBudgetButton } from "./DeleteBudgetButton";

export const dynamic = "force-dynamic";

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("accountant");
  const { id } = await params;
  const budgetId = Number(id);

  const [data, accounts, varianceData] = await Promise.all([
    getBudget(budgetId),
    listBudgetableAccounts(),
    getBudgetVsActual(budgetId).catch(() => null),
  ]);
  if (!data) notFound();
  const { budget, lines } = data;

  return (
    <>
      <PageHeader title={budget.name} subtitle={`Fiscal year ${budget.fiscalYear}`} action={<DeleteBudgetButton id={budget.id} />} />

      <BudgetGrid
        budgetId={budget.id}
        fiscalYear={budget.fiscalYear}
        accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }))}
        lines={lines.map((l) => ({ accountId: l.accountId, month: l.month, amountCents: l.amountCents }))}
      />

      {varianceData && (
        <div className="mt-8">
          <h2 className="text-[14px] font-semibold mb-3">Budget vs. Actual — full year</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-left">
              <thead className="hairline-b">
                <tr>
                  <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Account</th>
                  <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Budget</th>
                  <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Actual</th>
                  <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {varianceData.rows.map((r) => {
                  // For expenses, spending more than budgeted is bad (positive variance = over budget).
                  // For income, earning more than budgeted is good (positive variance = ahead of plan).
                  const badVariance = r.type === "expense" ? r.varianceCents > 0 : r.varianceCents < 0;
                  return (
                    <tr key={r.accountId} className="hairline-t">
                      <td className="px-4 py-2.5 text-[13px] font-medium">{r.code} · {r.name}</td>
                      <td className="px-3 py-2.5 text-[13px] text-right tnum">{fmtKES(r.budgetCents)}</td>
                      <td className="px-3 py-2.5 text-[13px] text-right tnum">{fmtKES(r.actualCents)}</td>
                      <td className={`px-4 py-2.5 text-[13px] text-right tnum font-medium ${badVariance ? "text-[var(--color-bad)]" : "text-[var(--color-good)]"}`}>
                        {r.varianceCents >= 0 ? "+" : ""}{fmtKES(r.varianceCents)}
                      </td>
                    </tr>
                  );
                })}
                {varianceData.rows.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--color-ink-400)] text-[13px]">No budget lines or activity yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
