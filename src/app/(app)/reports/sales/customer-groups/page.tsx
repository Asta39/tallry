export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { customerGroupsReport } from "@/lib/reports";
import { withOrg } from "@/lib/org";
import { fmtKESCompact } from "@/lib/money";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportChart } from "@/components/ReportCharts";
import { resolvePeriod } from "@/lib/report-period";

export default async function CustomerGroupsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { preset, from: fromDate, to: toDate } = resolvePeriod(sp);
  const groups = await withOrg(() => customerGroupsReport(fromDate, toDate));

  const topGroups = groups
    .filter((g) => g.totalSalesCents > 0)
    .slice(0, 8)
    .map((g) => ({ name: g.groupName, value: g.totalSalesCents / 100 }));
  const balances = groups
    .filter((g) => g.totalSalesCents > 0)
    .slice(0, 8)
    .map((g) => ({ name: g.groupName, value: g.balanceCents / 100 }));

  return (
    <div className="pb-10 pt-2">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reports/sales" className="btn-secondary px-3 py-1.5 text-xs text-[var(--color-ink-600)]">
          &larr; Back to Sales Dashboard
        </Link>
      </div>

      <PageHeader title="Customer Groups Report" subtitle="Sales performance grouped by customer segment" />

      <ReportFilters preset={preset} from={fromDate} to={toDate} />

      <div className="rounded-xl border border-[var(--color-ink-200)] bg-[var(--color-ink-50)] px-4 py-3 text-[12.5px] text-[var(--color-ink-600)] mb-6">
        Customers can belong to more than one customer group, so a customer's sales can appear in multiple groups.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ReportChart title="Top customer groups by sales" kind="bar" data={topGroups} />
        <ReportChart title="Balance due by customer group" kind="bar" data={balances} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)]">
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Customer group</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Customers</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Invoices</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Sales</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Received</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Balance due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[var(--color-ink-400)]">
                    No customer groups yet.
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <tr key={g.groupId} className="hover:bg-[var(--color-ink-50)]/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-[var(--color-ink-900)]">{g.groupName}</td>
                    <td className="px-5 py-3 text-right">{g.customerCount}</td>
                    <td className="px-5 py-3 text-right">{g.invoiceCount}</td>
                    <td className="px-5 py-3 text-right font-medium text-[var(--color-ink-900)]">{fmtKESCompact(g.totalSalesCents)}</td>
                    <td className="px-5 py-3 text-right text-green-700">{fmtKESCompact(g.paidCents)}</td>
                    <td className="px-5 py-3 text-right text-red-700 font-medium">{fmtKESCompact(g.balanceCents)}</td>
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
