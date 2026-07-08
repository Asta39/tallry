"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui";

const salesReports = [
  { href: "/reports/sales/invoices", title: "Invoices Report" },
  { href: "/reports/sales/items", title: "Items Report" },
  { href: "/reports/sales/payments", title: "Payments Received" },
  { href: "/reports/sales/credit-notes", title: "Credit Notes Report" },
  { href: "/reports/sales/estimates", title: "Estimates Report" },
  { href: "/reports/sales/customers", title: "Customers Report" },
];

const chartsReports = [
  { href: "/reports/sales/income", title: "Total Income" },
  { href: "/reports/sales/payment-modes", title: "Payment Modes" },
  { href: "/reports/sales/top-customers", title: "Top Customers" },
];

export default function SalesReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full h-screen-main pt-2 pb-6">
      <div className="mb-4">
        <PageHeader title="Sales Reports" subtitle="Detailed breakdown of your sales performance" />
      </div>

      <div className="flex flex-col md:flex-row flex-1 gap-5 overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-64 lg:w-72 flex flex-col bg-white border border-[var(--color-ink-200)] rounded-lg overflow-hidden flex-shrink-0">
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 px-2">
                <svg className="w-4 h-4 text-[var(--color-ink-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xs font-bold text-[var(--color-ink-600)] tracking-wider uppercase">Sales Report</h3>
              </div>
              <ul className="space-y-1">
                {salesReports.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link 
                        href={item.href}
                        className={`flex items-center gap-2 px-3 py-2 text-[13.5px] rounded-md transition-colors ${
                          isActive 
                            ? "bg-[var(--color-accent)] text-white font-medium" 
                            : "text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)] hover:text-[var(--color-ink-900)]"
                        }`}
                      >
                        <span className={`text-[10px] ${isActive ? "text-white/80" : "text-[var(--color-ink-300)]"}`}>›</span>
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3 px-2">
                <svg className="w-4 h-4 text-[var(--color-ink-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="text-xs font-bold text-[var(--color-ink-600)] tracking-wider uppercase">Charts Based Report</h3>
              </div>
              <ul className="space-y-1">
                {chartsReports.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link 
                        href={item.href}
                        className={`flex items-center gap-2 px-3 py-2 text-[13.5px] rounded-md transition-colors ${
                          isActive 
                            ? "bg-[var(--color-accent)] text-white font-medium" 
                            : "text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)] hover:text-[var(--color-ink-900)]"
                        }`}
                      >
                        <span className={`text-[10px] ${isActive ? "text-white/80" : "text-[var(--color-ink-300)]"}`}>›</span>
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          
          <div className="p-3 bg-[var(--color-bad-light)] border-t border-[var(--color-bad)]/20 text-[12px] text-[var(--color-bad)] font-medium flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Cancelled invoices are excluded
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
