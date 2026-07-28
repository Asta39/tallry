import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { paymentsReport } from "@/lib/reports";
import { withOrg } from "@/lib/org";
import { fmtKESCompact } from "@/lib/money";
import { PdfLinks } from "@/components/reportShared";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportChart } from "@/components/ReportCharts";
import { resolvePeriod } from "@/lib/report-period";

export default async function PaymentsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { preset, from: fromDate, to: toDate } = resolvePeriod(sp);

  const payments = await withOrg(() => paymentsReport(fromDate, toDate));

  const byMethod = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const p of payments) {
    const m = (p.method || "other").replace("_", " ");
    byMethod.set(m, (byMethod.get(m) ?? 0) + p.amountCents / 100);
    byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.amountCents / 100);
  }
  const methodMix = [...byMethod.entries()].map(([k, value]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    value,
  }));
  const paymentTrend = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, value]) => ({ name, value }));

  return (
    <div className="pb-10 pt-2">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reports/sales" className="btn-secondary px-3 py-1.5 text-xs text-[var(--color-ink-600)]">
          &larr; Back to Sales Dashboard
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <PageHeader title="Payments Received" subtitle="All payments recorded against sales" />
        
        <div className="flex items-center gap-3">
          <PdfLinks report="payments" from={fromDate} to={toDate} />
        </div>
      </div>

      <ReportFilters preset={preset} from={fromDate} to={toDate} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ReportChart title="Collected per day" kind="line" data={paymentTrend} />
        <ReportChart title="Payments by mode" kind="pie" data={methodMix} />
      </div>


      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)]">
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Date</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Payment #</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Invoice #</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Customer</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Mode</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[var(--color-ink-400)]">
                    No payments received in this period.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--color-ink-50)]/50 transition-colors">
                    <td className="px-5 py-3 text-[var(--color-ink-600)]">{p.date}</td>
                    <td className="px-5 py-3 font-medium text-[var(--color-ink-900)]">
                      <Link href={`/sales/payments/${p.id}`} className="hover:underline hover:text-[var(--color-accent-600)]">
                        {p.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-ink-600)]">{p.invoiceNumber || "-"}</td>
                    <td className="px-5 py-3 font-medium text-[var(--color-ink-900)]">{p.customerName || "-"}</td>
                    <td className="px-5 py-3 text-[var(--color-ink-600)] capitalize">{p.method?.replace('_', ' ') || "-"}</td>
                    <td className="px-5 py-3 text-right font-medium text-[var(--color-ink-900)]">
                      {fmtKESCompact(p.amountCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {payments.length > 0 && (
              <tfoot className="bg-[var(--color-ink-50)] font-semibold text-[var(--color-ink-900)] border-t border-[var(--color-ink-200)]">
                <tr>
                  <td colSpan={5} className="px-5 py-3 text-right">Total:</td>
                  <td className="px-5 py-3 text-right">
                    {fmtKESCompact(payments.reduce((sum, p) => sum + p.amountCents, 0))}
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
