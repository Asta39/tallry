import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { itemsReport } from "@/lib/reports";
import { withOrg } from "@/lib/org";
import { fmtKESCompact } from "@/lib/money";
import { PdfLinks } from "@/components/reportShared";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportChart } from "@/components/ReportCharts";
import { resolvePeriod } from "@/lib/report-period";

export default async function ItemsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { preset, from: fromDate, to: toDate } = resolvePeriod(sp);

  const items = await withOrg(() => itemsReport(fromDate, toDate));

  const topByRevenue = [...items]
    .sort((a, b) => b.amountSoldCents - a.amountSoldCents)
    .slice(0, 8)
    .map((i) => ({ name: i.itemName, value: i.amountSoldCents / 100 }));
  const topByQty = [...items]
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 8)
    .map((i) => ({ name: i.itemName, value: Number(i.quantitySold) }));

  return (
    <div className="pb-10 pt-2">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reports/sales" className="btn-secondary px-3 py-1.5 text-xs text-[var(--color-ink-600)]">
          &larr; Back to Sales Dashboard
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <PageHeader title="Items Report" subtitle="Sales grouped by items/services sold" />
        
        <div className="flex items-center gap-3">
          <PdfLinks report="items" from={fromDate} to={toDate} />
        </div>
      </div>

      <ReportFilters preset={preset} from={fromDate} to={toDate} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ReportChart title="Top items by revenue" kind="bar" data={topByRevenue} />
        <ReportChart title="Top items by units sold" kind="bar" data={topByQty} money={false} />
      </div>


      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)]">
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">Item Name</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)]">SKU</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Quantity Sold</th>
                <th className="px-5 py-3 font-semibold text-[var(--color-ink-600)] text-right">Amount Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">
                    No items sold in this period.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.itemId} className="hover:bg-[var(--color-ink-50)]/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-[var(--color-ink-900)]">{item.itemName}</td>
                    <td className="px-5 py-3 text-[var(--color-ink-600)]">{item.sku || "-"}</td>
                    <td className="px-5 py-3 text-right text-[var(--color-ink-900)] font-medium">
                      {item.quantitySold}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-[var(--color-ink-900)]">
                      {fmtKESCompact(item.amountSoldCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot className="bg-[var(--color-ink-50)] font-semibold text-[var(--color-ink-900)] border-t border-[var(--color-ink-200)]">
                <tr>
                  <td colSpan={2} className="px-5 py-3 text-right">Total:</td>
                  <td className="px-5 py-3 text-right">
                    {items.reduce((sum, item) => sum + item.quantitySold, 0)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {fmtKESCompact(items.reduce((sum, item) => sum + item.amountSoldCents, 0))}
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
