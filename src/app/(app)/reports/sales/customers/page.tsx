export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { customersReport } from "@/lib/reports";
import { withOrg } from "@/lib/org";
import { fmtKESCompact } from "@/lib/money";
import { PdfLinks } from "@/components/reportShared";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportChart } from "@/components/ReportCharts";
import { resolvePeriod } from "@/lib/report-period";
import { listCustomerGroups } from "@/lib/customer-groups";

export default async function CustomersReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; group?: string }>;
}) {
  const sp = await searchParams;
  const { preset, from: fromDate, to: toDate } = resolvePeriod(sp);
  const groups = await listCustomerGroups();
  const groupId = sp.group && groups.some((g) => g.id === Number(sp.group)) ? Number(sp.group) : "";

  const customers = await withOrg(() => customersReport(fromDate, toDate, groupId || null));

  const topCustomers = [...customers]
    .sort((a, b) => b.totalSalesCents - a.totalSalesCents)
    .slice(0, 8)
    .map((c) => ({ name: c.customerName || "—", value: c.totalSalesCents / 100 }));
  const receivedVsDue = [
    { name: "Received", value: customers.reduce((s, c) => s + c.paidCents, 0) / 100 },
    { name: "Balance due", value: customers.reduce((s, c) => s + c.balanceCents, 0) / 100 },
  ].filter((d) => d.value > 0);

  return (
    <div className="pb-10 pt-2">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reports/sales" className="btn-secondary px-3 py-1.5 text-xs text-[var(--color-ink-600)]">
          &larr; Back to Sales Dashboard
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <PageHeader title="Customers Report" subtitle="Sales performance grouped by customer" />
        
        <div className="flex items-center gap-3">
          <PdfLinks report="customers" from={fromDate} to={toDate} />
        </div>
      </div>

      <ReportFilters
        preset={preset}
        from={fromDate}
        to={toDate}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        groupId={groupId}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ReportChart title="Top customers by sales" kind="bar" data={topCustomers} />
        <ReportChart title="Received vs balance due" kind="pie" data={receivedVsDue} />
      </div>


      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)]">
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Customer Name</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Invoice Sales</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Amount Received</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">
                    No sales recorded in this period.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.contactId} className="hover:bg-[var(--color-ink-50)]/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-[var(--color-ink-900)]">
                      <Link href={`/contacts/${c.contactId}`} className="hover:underline hover:text-[var(--color-accent-600)]">
                        {c.customerName || "-"}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-[var(--color-ink-900)]">
                      {fmtKESCompact(c.totalSalesCents)}
                    </td>
                    <td className="px-5 py-3 text-right text-green-700">
                      {fmtKESCompact(c.paidCents)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-red-700">
                      {fmtKESCompact(c.balanceCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {customers.length > 0 && (
              <tfoot className="bg-[var(--color-ink-50)] font-semibold text-[var(--color-ink-900)] border-t border-[var(--color-ink-200)]">
                <tr>
                  <td className="px-5 py-3 text-right">Total:</td>
                  <td className="px-5 py-3 text-right">
                    {fmtKESCompact(customers.reduce((sum, c) => sum + c.totalSalesCents, 0))}
                  </td>
                  <td className="px-5 py-3 text-right text-green-700">
                    {fmtKESCompact(customers.reduce((sum, c) => sum + c.paidCents, 0))}
                  </td>
                  <td className="px-5 py-3 text-right text-red-700">
                    {fmtKESCompact(customers.reduce((sum, c) => sum + c.balanceCents, 0))}
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
