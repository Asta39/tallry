import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { paymentsReport } from "@/lib/reports";
import { withOrg } from "@/lib/org";
import { fmtKESCompact } from "@/lib/money";

export default async function PaymentsReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const fromDate = `${currentMonth}-01`;
  const toDate = today;

  const payments = await withOrg(() => paymentsReport(fromDate, toDate));

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
