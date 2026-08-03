export const dynamic = "force-dynamic";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { itemsReport } from "@/lib/reports";
import { withOrg, getOrg } from "@/lib/org";
import { fmtKESCompact } from "@/lib/money";
import { db, itemTypes } from "@/db";
import { eq, asc } from "drizzle-orm";
import { PdfLinks } from "@/components/reportShared";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportChart } from "@/components/ReportCharts";
import { resolvePeriod } from "@/lib/report-period";

export default async function ItemsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; itemType?: string }>;
}) {
  const sp = await searchParams;
  const { preset, from: fromDate, to: toDate, itemType } = resolvePeriod(sp) as ReturnType<typeof resolvePeriod> & { itemType?: string };
  if (sp.itemType) {
    // resolvePeriod drops unknown keys, so grab it manually
    // Wait, resolvePeriod might just return preset, from, to.
  }
  const o = await getOrg();
  const filterItemType = sp.itemType || "";

  const [items, allTypes] = await Promise.all([
    withOrg(() => itemsReport(fromDate, toDate, filterItemType || undefined)),
    db.select().from(itemTypes).where(eq(itemTypes.orgId, o.id)).orderBy(asc(itemTypes.name))
  ]);

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

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <ReportFilters preset={preset} from={fromDate} to={toDate} />
        <form method="get" className="flex items-center gap-2">
          {preset && <input type="hidden" name="period" value={preset} />}
          {sp.from && <input type="hidden" name="from" value={sp.from} />}
          {sp.to && <input type="hidden" name="to" value={sp.to} />}
          <label className="text-[13px] font-medium text-[var(--color-ink-600)]">Item Type:</label>
          <select 
            name="itemType" 
            defaultValue={filterItemType} 
            onChange={(e) => e.target.form?.submit()}
            className="rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none"
          >
            <option value="">All Types</option>
            {allTypes.map(t => (
              <option key={t.id} value={t.name}>{t.name.charAt(0).toUpperCase() + t.name.slice(1)}</option>
            ))}
          </select>
        </form>
      </div>

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
