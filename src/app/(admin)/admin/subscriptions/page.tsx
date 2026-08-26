export const dynamic = "force-dynamic";

import { db, subscriptions, org } from "@/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { resolveBillingAccess } from "@/lib/billing";
import { fmtKES } from "@/lib/money";

export default async function AdminSubscriptionsPage() {
  const subs = await db
    .select({
      id: subscriptions.id,
      orgId: subscriptions.orgId,
      orgName: org.name,
      billingStatus: subscriptions.billingStatus,
      trialEndsAt: subscriptions.trialEndsAt,
      monthlyFeeCents: subscriptions.monthlyFeeCents,
      nextMaintenanceDueAt: subscriptions.nextMaintenanceDueAt,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .leftJoin(org, eq(subscriptions.orgId, org.id))
    .orderBy(desc(subscriptions.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">All tenant billing records.</p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--color-ink-50)] border-b border-[var(--color-ink-200)] text-[13px] text-[var(--color-ink-600)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">Org</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Monthly fee</th>
                <th className="px-4 py-3 font-medium">Next due</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {subs.map((s) => {
                const billing = resolveBillingAccess({
                  billingStatus: s.billingStatus as "trial" | "active" | "suspended",
                  trialEndsAt: s.trialEndsAt,
                  activatedAt: null,
                  monthlyFeeCents: s.monthlyFeeCents,
                  nextMaintenanceDueAt: s.nextMaintenanceDueAt,
                });
                return (
                  <tr key={s.id} className="hover:bg-[var(--color-ink-50)] transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/admin/orgs/${s.orgId}`} className="hover:underline">{s.orgName || `Org #${s.orgId}`}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        billing.status === "locked" ? "bg-red-100 text-red-800"
                          : billing.status === "trial" ? "bg-amber-100 text-amber-800"
                          : "bg-green-100 text-green-800"
                      }`}>
                        {billing.status === "trial" ? `Trial · ${billing.trialDaysLeft}d left` : billing.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink-500)]">{s.monthlyFeeCents > 0 ? fmtKES(s.monthlyFeeCents) : "—"}</td>
                    <td className="px-4 py-3 text-[var(--color-ink-500)]">{s.nextMaintenanceDueAt || "—"}</td>
                    <td className="px-4 py-3 text-[var(--color-ink-500)]">{s.createdAt.slice(0, 10)}</td>
                  </tr>
                );
              })}
              {subs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-ink-500)]">
                    No subscriptions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
