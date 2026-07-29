import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { customerMarginRanking } from "@/lib/reports";
import { withOrg } from "@/lib/org";
import { fmtKES } from "@/lib/money";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportChart } from "@/components/ReportCharts";
import { resolvePeriod } from "@/lib/report-period";

export const dynamic = "force-dynamic";

export default async function CustomerProfitabilityReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { preset, from, to } = resolvePeriod(sp);
  const data = await withOrg(() => customerMarginRanking(from, to));

  const topMargin = data.rows
    .filter((r) => r.grossMarginCents > 0)
    .slice(0, 8)
    .map((r) => ({ name: r.customerName, value: r.grossMarginCents / 100 }));

  const losers = data.rows.filter((r) => r.grossMarginCents < 0);

  return (
    <div className="pb-10 pt-2">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reports/sales" className="btn-secondary px-3 py-1.5 text-xs text-[var(--color-ink-600)]">
          &larr; Back to Sales Dashboard
        </Link>
      </div>

      <PageHeader
        title="Customer Profitability"
        subtitle="Revenue less the costs tagged to each customer"
      />

      <ReportFilters preset={preset} from={from} to={to} />

      {/* The ranking is only as complete as the tagging — say so before the numbers. */}
      {data.untaggedCostCents > 0 && (
        <div className="card p-4 mb-6 border-dashed text-[12.5px] text-[var(--color-ink-600)]">
          ⚠︎ {fmtKES(data.untaggedCostCents)} of bills and expenses in this period aren&apos;t tagged to any customer,
          so they aren&apos;t reflected below. Every margin here is an upper bound — tag costs on expenses and bills to
          tighten it.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">Net revenue</div>
          <div className="text-[19px] font-semibold mt-1 tnum">{fmtKES(data.totalRevenueCents)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">Tagged costs</div>
          <div className="text-[19px] font-semibold mt-1 tnum">{fmtKES(data.totalCostCents)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">Gross margin</div>
          <div
            className={`text-[19px] font-semibold mt-1 tnum ${
              data.totalMarginCents < 0 ? "text-[var(--color-bad)]" : "text-[var(--color-good)]"
            }`}
          >
            {fmtKES(data.totalMarginCents)}
          </div>
        </div>
      </div>

      {topMargin.length > 0 && (
        <div className="mb-6">
          <ReportChart title="Most profitable customers" kind="bar" data={topMargin} />
        </div>
      )}

      {losers.length > 0 && (
        <div className="card p-4 mb-6">
          <div className="text-[12px] font-semibold text-[var(--color-bad)] mb-2">
            Losing money ({losers.length})
          </div>
          <div className="space-y-1 text-[13px]">
            {losers.map((r) => (
              <div key={r.contactId} className="flex justify-between gap-4">
                <Link href={`/contacts/${r.contactId}?tab=profitability`} className="hover:underline">
                  {r.customerName}
                </Link>
                <span className="tnum text-[var(--color-bad)]">{fmtKES(r.grossMarginCents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="bg-[var(--color-ink-50)] border-b border-[var(--color-ink-200)] text-[var(--color-ink-500)] text-[12px] uppercase tracking-wider">
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold text-right">Net revenue</th>
                <th className="px-5 py-3 font-semibold text-right">Tagged costs</th>
                <th className="px-5 py-3 font-semibold text-right">Gross margin</th>
                <th className="px-5 py-3 font-semibold text-right">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[var(--color-ink-500)]">
                    No customer activity in this period.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.contactId} className="hover:bg-[var(--color-ink-50)]/50 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/contacts/${r.contactId}?tab=profitability`}
                        className="font-medium hover:underline hover:text-[var(--color-accent-600)]"
                      >
                        {r.customerName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtKES(r.netRevenueCents)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[var(--color-ink-500)]">
                      {r.taggedCostCents > 0 ? fmtKES(r.taggedCostCents) : "—"}
                    </td>
                    <td
                      className={`px-5 py-3 text-right tabular-nums font-medium ${
                        r.grossMarginCents < 0 ? "text-[var(--color-bad)]" : ""
                      }`}
                    >
                      {fmtKES(r.grossMarginCents)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-[var(--color-ink-500)]">
                      {r.marginPct === null ? "—" : `${(r.marginPct * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.rows.length > 0 && (
              <tfoot>
                <tr className="bg-[var(--color-ink-50)] border-t border-[var(--color-ink-200)] font-semibold">
                  <td className="px-5 py-3">{data.rows.length} customer(s)</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtKES(data.totalRevenueCents)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtKES(data.totalCostCents)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtKES(data.totalMarginCents)}</td>
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
