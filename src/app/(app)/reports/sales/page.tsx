import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { salesDashboardStats } from "@/lib/reports";
import { SalesDashboardCharts } from "./SalesDashboardCharts";

const reportCards = [
  { href: "/reports/sales/invoices", title: "Invoices Report", desc: "Detailed view of all generated invoices.", icon: "📄" },
  { href: "/reports/sales/items", title: "Items Report", desc: "Sales grouped by items/services sold.", icon: "📦" },
  { href: "/reports/sales/payments", title: "Payments Received", desc: "All payments recorded against sales.", icon: "💰" },
  { href: "/reports/sales/credit-notes", title: "Credit Notes Report", desc: "History of credit notes issued.", icon: "📉" },
  { href: "/reports/sales/estimates", title: "Estimates Report", desc: "Summary of estimates and quotes.", icon: "📝" },
  { href: "/reports/sales/customers", title: "Customers Report", desc: "Sales performance grouped by customer.", icon: "👥" },
];

export default async function SalesDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const stats = await salesDashboardStats(today);

  return (
    <div className="pb-10 pt-2">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reports" className="btn-secondary px-3 py-1.5 text-xs text-[var(--color-ink-600)]">
          &larr; Back to Reports
        </Link>
      </div>

      <PageHeader title="Sales Overview" subtitle="High-level charts and detailed sales reports" />

      <SalesDashboardCharts stats={stats} />

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
