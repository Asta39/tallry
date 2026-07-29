export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { estimatesReport } from "@/lib/reports";
import { withOrg } from "@/lib/org";
import { fmtKESCompact } from "@/lib/money";
import { PdfLinks } from "@/components/reportShared";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportChart } from "@/components/ReportCharts";
import { resolvePeriod } from "@/lib/report-period";

export default async function EstimatesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { preset, from: fromDate, to: toDate } = resolvePeriod(sp);

  const estimates = await withOrg(() => estimatesReport(fromDate, toDate));

  const byStatus = new Map<string, number>();
  for (const e of estimates) byStatus.set(e.status, (byStatus.get(e.status) ?? 0) + e.totalCents / 100);
  const statusMix = [...byStatus.entries()].map(([k, value]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    value,
  }));
  const topEstimates = [...estimates]
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 8)
    .map((e) => ({ name: e.number, value: e.totalCents / 100 }));

  return (
    <div className="pb-10 pt-2">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reports/sales" className="btn-secondary px-3 py-1.5 text-xs text-[var(--color-ink-600)]">
          &larr; Back to Sales Dashboard
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <PageHeader title="Estimates Report" subtitle="Summary of estimates and quotes" />
        
        <div className="flex items-center gap-3">
          <PdfLinks report="estimates" from={fromDate} to={toDate} />
        </div>
      </div>

      <ReportFilters preset={preset} from={fromDate} to={toDate} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ReportChart title="Estimate value by status" kind="pie" data={statusMix} />
        <ReportChart title="Largest estimates" kind="bar" data={topEstimates} />
      </div>


      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)]">
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Date</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Estimate #</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Customer Name</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Status</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {estimates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[var(--color-ink-400)]">
                    No estimates created in this period.
                  </td>
                </tr>
              ) : (
                estimates.map((e) => (
                  <tr key={e.id} className="hover:bg-[var(--color-ink-50)]/50 transition-colors">
                    <td className="px-5 py-3 text-[var(--color-ink-600)]">{e.date}</td>
                    <td className="px-5 py-3 font-medium text-[var(--color-ink-900)]">
                      <Link href={`/sales/quotes/${e.id}`} className="hover:underline hover:text-[var(--color-accent-600)]">
                        {e.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-medium text-[var(--color-ink-900)]">{e.customerName || "-"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
                        ${e.status === 'accepted' ? 'bg-green-50 text-green-700' : ''}
                        ${e.status === 'rejected' ? 'bg-red-50 text-red-700' : ''}
                        ${e.status === 'sent' ? 'bg-blue-50 text-blue-700' : ''}
                        ${e.status === 'draft' ? 'bg-yellow-50 text-yellow-700' : ''}
                        ${!['accepted', 'rejected', 'sent', 'draft'].includes(e.status) ? 'bg-[var(--color-ink-100)] text-[var(--color-ink-700)]' : ''}
                      `}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-[var(--color-ink-900)]">
                      {fmtKESCompact(e.totalCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {estimates.length > 0 && (
              <tfoot className="bg-[var(--color-ink-50)] font-semibold text-[var(--color-ink-900)] border-t border-[var(--color-ink-200)]">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right">Total:</td>
                  <td className="px-5 py-3 text-right">
                    {fmtKESCompact(estimates.reduce((sum, e) => sum + e.totalCents, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
