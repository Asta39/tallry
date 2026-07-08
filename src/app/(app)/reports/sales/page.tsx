import Link from "next/link";
import { PageHeader } from "@/components/ui";

const reportCards = [
  { href: "/reports/sales/invoices", title: "Invoices Report", desc: "Detailed view of all generated invoices.", icon: "📄" },
  { href: "/reports/sales/items", title: "Items Report", desc: "Sales grouped by items/services sold.", icon: "📦" },
  { href: "/reports/sales/payments", title: "Payments Received", desc: "All payments recorded against sales.", icon: "💰" },
  { href: "/reports/sales/credit-notes", title: "Credit Notes Report", desc: "History of credit notes issued.", icon: "📉" },
  { href: "/reports/sales/estimates", title: "Estimates Report", desc: "Summary of estimates and quotes.", icon: "📝" },
  { href: "/reports/sales/customers", title: "Customers Report", desc: "Sales performance grouped by customer.", icon: "👥" },
];

export default function SalesDashboard() {
  return (
    <div className="pb-10 pt-2">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reports" className="btn-secondary px-3 py-1.5 text-xs text-[var(--color-ink-600)]">
          &larr; Back to Reports
        </Link>
      </div>

      <PageHeader title="Sales Overview" subtitle="High-level charts and detailed sales reports" />

      {/* Charts Section Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        
        {/* Total Income Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[14px]">Total Income</h3>
            <select className="text-xs border-none bg-[var(--color-ink-50)] rounded px-2 py-1 text-[var(--color-ink-600)] outline-none cursor-pointer">
              <option>Last 6 Months</option>
              <option>This Year</option>
            </select>
          </div>
          <div className="h-64 flex items-center justify-center bg-[var(--color-ink-50)]/50 rounded border border-dashed border-[var(--color-ink-200)]">
            <span className="text-[var(--color-ink-400)] text-sm flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Line Chart Placeholder
            </span>
          </div>
        </div>

        {/* Payment Modes Chart */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[14px]">Payment Modes</h3>
            <select className="text-xs border-none bg-[var(--color-ink-50)] rounded px-2 py-1 text-[var(--color-ink-600)] outline-none cursor-pointer">
              <option>This Month</option>
              <option>This Year</option>
            </select>
          </div>
          <div className="flex-1 flex items-center justify-center bg-[var(--color-ink-50)]/50 rounded border border-dashed border-[var(--color-ink-200)] min-h-[200px]">
            <span className="text-[var(--color-ink-400)] text-sm flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              Doughnut Chart Placeholder
            </span>
          </div>
        </div>

      </div>

      <div className="h-px w-full bg-[var(--color-ink-200)] mb-8" />

      {/* Report Links Grid */}
      <div className="mb-6">
        <h2 className="text-[16px] font-bold text-[var(--color-ink-900)] mb-4">Detailed Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportCards.map((report) => (
            <Link key={report.href} href={report.href} className="card p-5 hover:shadow-md transition-all hover:-translate-y-0.5 border-[var(--color-ink-200)] group">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--color-ink-50)] flex items-center justify-center text-xl group-hover:bg-[var(--color-accent)]/10 transition-colors">
                  {report.icon}
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--color-ink-900)] mb-1 group-hover:text-[var(--color-accent)] transition-colors">
                    {report.title}
                  </h3>
                  <p className="text-[12.5px] text-[var(--color-ink-500)]">
                    {report.desc}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      
    </div>
  );
}
