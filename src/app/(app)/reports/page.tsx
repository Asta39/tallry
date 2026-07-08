import Link from "next/link";
import { requirePerm } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { dashboardStats, monthlyIncomeExpense } from "@/lib/reports";
import { fmtKES, todayISO } from "@/lib/money";
import { withOrg } from "@/lib/org";
import { IncomeExpenseChart } from "@/components/IncomeExpenseChart";

export const dynamic = "force-dynamic";

const reports = [
  {
    group: "Sales",
    items: [
      { href: "/reports/sales", title: "Sales Reports", body: "Detailed breakdown of invoices, items, and customers." },
    ],
  },
  {
    group: "Performance",
    items: [
      { href: "/reports/pnl", title: "Profit & Loss", body: "Income minus spending — did you make money?" },
      { href: "/reports/income-expense", title: "Income vs Expense", body: "Monthly breakdown over the last 12 months." },
      { href: "/reports/cash-flow", title: "Cash Flow Statement", body: "Simplified cash movement grouped by activity." },
    ],
  },
  {
    group: "Position",
    items: [
      { href: "/reports/balance-sheet", title: "Balance Sheet", body: "What you own vs what you owe, right now." },
      { href: "/reports/aging", title: "Aged Receivables (Aging)", body: "Unpaid invoices and bills, bucketed by lateness." },
    ],
  },
  {
    group: "Detailed & Compliance",
    items: [
      { href: "/reports/general-ledger", title: "General Ledger", body: "Detailed transaction history for specific accounts." },
      { href: "/reports/trial-balance", title: "Trial Balance", body: "Every account's debits and credits — for your accountant." },
      { href: "/reports/vat", title: "VAT Return (VAT 3) prep", body: "Output VAT vs input VAT for the period." },
    ],
  },
];

export default async function ReportsPage() {
  await requirePerm("reports");

  const today = todayISO();
  const stats = await withOrg(() => dashboardStats(today));
  const incomeExpenseData = await withOrg(() => monthlyIncomeExpense(6));

  const totalIncome = stats.incomeThisMonthCents;
  const netIncome = stats.incomeThisMonthCents - stats.expensesThisMonthCents;
  
  const currentAssets = stats.cashCents + stats.receivablesCents;
  const currentLiabilities = stats.payablesCents; // Approximation
  const currentRatio = currentLiabilities > 0 ? (currentAssets / currentLiabilities).toFixed(2) : "—";
  const profitMargin = totalIncome > 0 ? ((netIncome / totalIncome) * 100).toFixed(1) + "%" : "—";

  return (
    <>
      <PageHeader title="Reports & Dashboard" subtitle="Financial overview and detailed statements" />
      
      {/* iOS Inspired Mini Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        
        {/* Quick Looks (Metrics) */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          <div className="card p-5 bg-gradient-to-br from-[var(--color-ink-50)] to-white">
            <div className="text-[12.5px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wider mb-1">Revenue (MTD)</div>
            <div className="text-2xl font-bold text-[var(--color-ink-900)]">{fmtKES(totalIncome)}</div>
          </div>
          
          <div className="card p-5 bg-gradient-to-br from-[var(--color-ink-50)] to-white">
            <div className="text-[12.5px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wider mb-1">Net Income (MTD)</div>
            <div className={`text-2xl font-bold ${netIncome >= 0 ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"}`}>
              {fmtKES(netIncome)}
            </div>
          </div>

          <div className="card p-5 bg-gradient-to-br from-[var(--color-ink-50)] to-white">
            <div className="text-[12.5px] font-semibold text-[var(--color-ink-500)] uppercase tracking-wider mb-1">Receivables</div>
            <div className="text-2xl font-bold text-[var(--color-ink-900)]">{fmtKES(stats.receivablesCents)}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="card p-4">
              <div className="text-[11.5px] text-[var(--color-ink-500)] uppercase">Current Ratio</div>
              <div className="text-lg font-bold mt-1">{currentRatio}</div>
            </div>
            <div className="card p-4">
              <div className="text-[11.5px] text-[var(--color-ink-500)] uppercase">Profit Margin</div>
              <div className="text-lg font-bold mt-1">{profitMargin}</div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="text-[14px] font-semibold mb-4">Income vs Expense (6 Months)</h2>
          <IncomeExpenseChart data={incomeExpenseData} />
        </div>
      </div>

      <div className="h-px w-full bg-[var(--color-ink-200)] mb-8"></div>

      {/* Reports List */}
      {reports.map((g) => (
        <div key={g.group} className="mb-7">
          <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-3">{g.group}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {g.items.map((r) => (
              <Link key={r.href} href={r.href} className="card px-5 py-4 hover:shadow-md transition-all hover:-translate-y-0.5 border-[var(--color-ink-200)]">
                <div className="text-[14px] font-semibold text-[var(--color-ink-900)] flex items-center justify-between">
                  {r.title}
                  <span className="text-[var(--color-ink-300)]">→</span>
                </div>
                <p className="text-[12.5px] text-[var(--color-ink-500)] mt-1.5">{r.body}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
