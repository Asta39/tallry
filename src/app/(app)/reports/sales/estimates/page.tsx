import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { estimatesReport } from "@/lib/reports";
import { withOrg } from "@/lib/org";
import { fmtKESCompact } from "@/lib/money";

export default async function EstimatesReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const fromDate = `${currentMonth}-01`;
  const toDate = today;

  const estimates = await withOrg(() => estimatesReport(fromDate, toDate));

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
          <button className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 text-[var(--color-ink-700)]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View
          </button>
          
          <button className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 text-[var(--color-ink-700)]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>

      <div className="card p-5 mb-6 bg-[var(--color-ink-50)] border-dashed">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1">Period</label>
            <select 
              className="w-full md:w-64 bg-white border border-[var(--color-ink-200)] text-[var(--color-ink-900)] text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
              defaultValue="this_month"
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>
          
          <button className="btn-primary px-5 py-2 text-sm whitespace-nowrap">
            Update Report
          </button>
        </div>
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
