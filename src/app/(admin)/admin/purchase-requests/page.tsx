export const dynamic = "force-dynamic";

import { db, purchaseRequests } from "@/db";
import { desc } from "drizzle-orm";
import { fmtKES } from "@/lib/money";
import { StatusControl } from "./StatusControl";
import { DeleteButton } from "./DeleteButton";

const statusBadge: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  contacted: "bg-blue-50 text-blue-700 border-blue-200",
  activated: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-[var(--color-ink-50)] text-[var(--color-ink-400)] border-[var(--color-ink-200)]",
};

export default async function AdminPurchaseRequestsPage() {
  const rows = await db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.createdAt)).limit(200);

  // Cancelled rows (test junk / withdrawn leads) are excluded from the
  // pipeline analytics — they were never real revenue potential.
  const live = rows.filter((r) => r.status !== "cancelled");
  const pending = live.filter((r) => r.status === "pending");
  const contacted = live.filter((r) => r.status === "contacted");
  const activated = live.filter((r) => r.status === "activated");
  const cancelledCount = rows.length - live.length;

  const pipelineValue = pending.reduce((s, r) => s + r.amountCents, 0) + contacted.reduce((s, r) => s + r.amountCents, 0);
  const wonRevenue = activated.reduce((s, r) => s + r.amountCents, 0);
  const conversionRate = live.length > 0 ? Math.round((activated.length / live.length) * 100) : 0;

  const packageCounts = new Map<string, number>();
  for (const r of live) packageCounts.set(r.packageLabel, (packageCounts.get(r.packageLabel) ?? 0) + 1);
  const packageBreakdown = [...packageCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Purchase Requests</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">One-time-purchase leads submitted from the public pricing page — follow up for payment, then mark activated once the org is set up.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">Open pipeline</div>
          <div className="text-[22px] font-semibold tnum mt-1">{fmtKES(pipelineValue)}</div>
          <div className="text-[11.5px] text-[var(--color-ink-400)] mt-0.5">{pending.length} pending · {contacted.length} contacted</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">Won revenue</div>
          <div className="text-[22px] font-semibold tnum mt-1 text-emerald-700">{fmtKES(wonRevenue)}</div>
          <div className="text-[11.5px] text-[var(--color-ink-400)] mt-0.5">{activated.length} activated</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">Conversion rate</div>
          <div className="text-[22px] font-semibold tnum mt-1">{conversionRate}%</div>
          <div className="text-[11.5px] text-[var(--color-ink-400)] mt-0.5">{live.length} real leads</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">Cancelled</div>
          <div className="text-[22px] font-semibold tnum mt-1 text-[var(--color-ink-400)]">{cancelledCount}</div>
          <div className="text-[11.5px] text-[var(--color-ink-400)] mt-0.5">excluded from stats above</div>
        </div>
      </div>

      {packageBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-5">
          <h2 className="text-[13.5px] font-semibold mb-3">Package popularity</h2>
          <div className="space-y-2">
            {packageBreakdown.map(([label, n]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-[12.5px] w-48 shrink-0 truncate">{label}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--color-ink-50)] overflow-hidden">
                  <div className="h-full bg-[var(--color-accent-500)]" style={{ width: `${(n / live.length) * 100}%` }} />
                </div>
                <span className="text-[12.5px] tnum text-[var(--color-ink-400)] w-6 text-right">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--color-ink-50)] border-b border-[var(--color-ink-200)] text-[13px] text-[var(--color-ink-600)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Package</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--color-ink-50)] transition-colors">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{r.phone}</td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">{r.packageLabel}</td>
                  <td className="px-4 py-3 text-right tnum font-medium">{fmtKES(r.amountCents)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusBadge[r.status] || ""}`}>
                        {r.status}
                      </span>
                      <StatusControl id={r.id} status={r.status} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-500)]">{r.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-4 py-3">
                    <DeleteButton id={r.id} name={r.name} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-ink-500)]">No purchase requests yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
