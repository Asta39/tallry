export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { itemGroupsReport } from "@/lib/reports";
import { withOrg } from "@/lib/org";
import { fmtKESCompact } from "@/lib/money";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportChart } from "@/components/ReportCharts";
import { resolvePeriod } from "@/lib/report-period";

export default async function ItemGroupsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { preset, from: fromDate, to: toDate } = resolvePeriod(sp);
  const groups = await withOrg(() => itemGroupsReport(fromDate, toDate));

  const topGroups = groups
    .filter((g) => g.amountSoldCents > 0)
    .slice(0, 8)
    .map((g) => ({ name: g.groupName, value: g.amountSoldCents / 100 }));
  const topQty = groups
    .filter((g) => g.quantitySold > 0)
    .slice(0, 8)
    .map((g) => ({ name: g.groupName, value: g.quantitySold }));

  return (
    <div className="pb-10 pt-2">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reports/sales" className="btn-secondary px-3 py-1.5 text-xs text-[var(--color-ink-600)]">
          &larr; Back to Sales Dashboard
        </Link>
      </div>

      <PageHeader title="Item Groups Report" subtitle="Sales grouped by item category" />

      <ReportFilters preset={preset} from={fromDate} to={toDate} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ReportChart title="Top item groups by sales" kind="bar" data={topGroups} />
        <ReportChart title="Top item groups by units sold" kind="bar" data={topQty} money={false} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)]">
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Item group</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Items sold</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Units sold</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">
                    No item groups or grouped item sales in this period.
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <tr key={g.groupId ?? -1} className="hover:bg-[var(--color-ink-50)]/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-[var(--color-ink-900)]">{g.groupName}</td>
                    <td className="px-5 py-3 text-right">{g.itemCount}</td>
                    <td className="px-5 py-3 text-right">{g.quantitySold}</td>
                    <td className="px-5 py-3 text-right font-medium text-[var(--color-ink-900)]">{fmtKESCompact(g.amountSoldCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
