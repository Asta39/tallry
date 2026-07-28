import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { creditNotesReport } from "@/lib/reports";
import { withOrg } from "@/lib/org";
import { fmtKESCompact } from "@/lib/money";
import { PdfLinks } from "@/components/reportShared";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportChart } from "@/components/ReportCharts";
import { resolvePeriod } from "@/lib/report-period";

export default async function CreditNotesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { preset, from: fromDate, to: toDate } = resolvePeriod(sp);

  const notes = await withOrg(() => creditNotesReport(fromDate, toDate));

  const byStatus = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const n of notes) {
    byStatus.set(n.status, (byStatus.get(n.status) ?? 0) + n.totalCents / 100);
    byDay.set(n.date, (byDay.get(n.date) ?? 0) + n.totalCents / 100);
  }
  const statusMix = [...byStatus.entries()].map(([k, value]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    value,
  }));
  const creditTrend = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, value]) => ({ name, value }));

  return (
    <div className="pb-10 pt-2">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reports/sales" className="btn-secondary px-3 py-1.5 text-xs text-[var(--color-ink-600)]">
          &larr; Back to Sales Dashboard
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <PageHeader title="Credit Notes Report" subtitle="History of credit notes issued" />
        
        <div className="flex items-center gap-3">
          <PdfLinks report="credit-notes" from={fromDate} to={toDate} />
        </div>
      </div>

      <ReportFilters preset={preset} from={fromDate} to={toDate} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ReportChart title="Credited per day" kind="line" data={creditTrend} />
        <ReportChart title="Credit notes by status" kind="pie" data={statusMix} />
      </div>


      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)]">
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Date</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Credit Note #</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Customer Name</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Status</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {notes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[var(--color-ink-400)]">
                    No credit notes issued in this period.
                  </td>
                </tr>
              ) : (
                notes.map((n) => (
                  <tr key={n.id} className="hover:bg-[var(--color-ink-50)]/50 transition-colors">
                    <td className="px-5 py-3 text-[var(--color-ink-600)]">{n.date}</td>
                    <td className="px-5 py-3 font-medium text-[var(--color-ink-900)]">
                      <Link href={`/sales/credit-notes/${n.id}`} className="hover:underline hover:text-[var(--color-accent-600)]">
                        {n.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-medium text-[var(--color-ink-900)]">{n.customerName || "-"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
                        ${n.status === 'open' ? 'bg-blue-50 text-blue-700' : ''}
                        ${n.status === 'closed' ? 'bg-gray-100 text-gray-700' : ''}
                        ${n.status === 'draft' ? 'bg-yellow-50 text-yellow-700' : ''}
                        ${!['open', 'closed', 'draft'].includes(n.status) ? 'bg-[var(--color-ink-100)] text-[var(--color-ink-700)]' : ''}
                      `}>
                        {n.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-[var(--color-ink-900)]">
                      {fmtKESCompact(n.totalCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {notes.length > 0 && (
              <tfoot className="bg-[var(--color-ink-50)] font-semibold text-[var(--color-ink-900)] border-t border-[var(--color-ink-200)]">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right">Total:</td>
                  <td className="px-5 py-3 text-right">
                    {fmtKESCompact(notes.reduce((sum, n) => sum + n.totalCents, 0))}
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
