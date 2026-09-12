export const dynamic = "force-dynamic";

import { db, purchaseRequests } from "@/db";
import { desc } from "drizzle-orm";
import { fmtKES } from "@/lib/money";
import { StatusControl } from "./StatusControl";

const statusBadge: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  contacted: "bg-blue-50 text-blue-700 border-blue-200",
  activated: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default async function AdminPurchaseRequestsPage() {
  const rows = await db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.createdAt)).limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Purchase Requests</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">One-time-purchase leads submitted from the public pricing page — follow up for payment, then mark activated once the org is set up.</p>
      </div>

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
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-ink-500)]">No purchase requests yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
