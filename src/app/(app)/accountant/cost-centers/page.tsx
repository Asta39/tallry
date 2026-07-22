import { requirePerm } from "@/lib/guard";
import { withOrg } from "@/lib/org";
import { listCostCenters } from "@/lib/cost-centers";
import { costCenterPnL } from "@/lib/reports";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader } from "@/components/ui";
import { CostCentersClient } from "./CostCentersClient";

export const dynamic = "force-dynamic";

export default async function CostCentersPage() {
  await requirePerm("accountant");
  const today = todayISO();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const [costCenters, pnl] = await Promise.all([
    listCostCenters(),
    withOrg(() => costCenterPnL(yearStart, today)),
  ]);

  return (
    <>
      <PageHeader title="Cost Centers" subtitle="Tag departments, projects, or locations on transactions to break down reports by dimension." />
      <CostCentersClient costCenters={costCenters} />

      <div className="mt-8">
        <h2 className="text-[14px] font-semibold mb-3">P&amp;L by cost center — year to date</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-left">
            <thead className="hairline-b">
              <tr>
                <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Cost center</th>
                <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Income</th>
                <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Expense</th>
                <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {pnl.map((row) => (
                <tr key={row.costCenterId ?? "unassigned"} className="hairline-t">
                  <td className="px-4 py-2.5 text-[13px] font-medium">
                    {row.name}
                    {row.costCenterId === null && <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--color-ink-400)]">not tagged</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] text-right tnum">{fmtKES(row.incomeCents)}</td>
                  <td className="px-3 py-2.5 text-[13px] text-right tnum">{fmtKES(row.expenseCents)}</td>
                  <td className={`px-4 py-2.5 text-[13px] text-right tnum font-medium ${row.netCents < 0 ? "text-[var(--color-bad)]" : ""}`}>{fmtKES(row.netCents)}</td>
                </tr>
              ))}
              {pnl.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--color-ink-400)] text-[13px]">No income or expense activity this year yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
