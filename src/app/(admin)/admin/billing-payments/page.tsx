export const dynamic = "force-dynamic";

import { db, billingPayments, org } from "@/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { fmtKES } from "@/lib/money";

export default async function AdminBillingPaymentsPage() {
  const rows = await db
    .select({
      id: billingPayments.id,
      orgId: billingPayments.orgId,
      orgName: org.name,
      kind: billingPayments.kind,
      amountCents: billingPayments.amountCents,
      method: billingPayments.method,
      state: billingPayments.state,
      note: billingPayments.note,
      createdAt: billingPayments.createdAt,
    })
    .from(billingPayments)
    .leftJoin(org, eq(billingPayments.orgId, org.id))
    .orderBy(desc(billingPayments.createdAt))
    .limit(200);

  const setupTotal = rows.filter((r) => r.kind === "setup_fee" && (r.state === "applied" || r.state === "COMPLETE")).reduce((s, r) => s + r.amountCents, 0);
  const maintTotal = rows.filter((r) => r.kind === "maintenance" && (r.state === "applied" || r.state === "COMPLETE")).reduce((s, r) => s + r.amountCents, 0);

  const stateBadge: Record<string, string> = {
    applied: "bg-emerald-50 text-emerald-700 border-emerald-200",
    COMPLETE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    PROCESSING: "bg-amber-50 text-amber-700 border-amber-200",
    FAILED: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing Payments</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">Every setup fee and maintenance payment recorded across the platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">Setup fees received</div>
          <div className="text-[22px] font-semibold tnum mt-1">{fmtKES(setupTotal)}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">Maintenance received</div>
          <div className="text-[22px] font-semibold tnum mt-1">{fmtKES(maintTotal)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--color-ink-50)] border-b border-[var(--color-ink-200)] text-[13px] text-[var(--color-ink-600)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">Org</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--color-ink-50)] transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/admin/orgs/${r.orgId}`} className="hover:underline">{r.orgName || `Org #${r.orgId}`}</Link>
                  </td>
                  <td className="px-4 py-3 capitalize">{r.kind === "setup_fee" ? "Setup fee" : "Maintenance"}</td>
                  <td className="px-4 py-3 capitalize">{r.method}</td>
                  <td className="px-4 py-3 text-right tnum font-medium">{fmtKES(r.amountCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${stateBadge[r.state] || "bg-[var(--color-ink-50)] text-[var(--color-ink-600)] border-[var(--color-ink-200)]"}`}>
                      {r.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-500)] max-w-[200px] truncate">{r.note || "—"}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-500)]">{r.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-ink-500)]">No payments recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
