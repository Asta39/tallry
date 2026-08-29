export const dynamic = "force-dynamic";

import { db, org, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ImpersonateButton } from "./ImpersonateButton";
import { resolveBillingAccess } from "@/lib/billing";

export default async function OrgsPage() {
  const orgsWithSubs = await db
    .select({
      id: org.id,
      name: org.name,
      email: org.email,
      phone: org.phone,
      portalSlug: org.portalSlug,
      crmEnabled: org.crmEnabled,
      accountingEnabled: org.accountingEnabled,
      payrollEnabled: org.payrollEnabled,
      billingStatus: subscriptions.billingStatus,
      trialEndsAt: subscriptions.trialEndsAt,
      monthlyFeeCents: subscriptions.monthlyFeeCents,
      nextMaintenanceDueAt: subscriptions.nextMaintenanceDueAt,
    })
    .from(org)
    .leftJoin(subscriptions, eq(org.id, subscriptions.orgId))
    .orderBy(org.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">Manage all tenants on the platform.</p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--color-ink-50)] border-b border-[var(--color-ink-200)] text-[13px] text-[var(--color-ink-600)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Modules</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {orgsWithSubs.map((o) => {
                const today = new Date().toISOString().slice(0, 10);
                const billing = o.trialEndsAt
                  ? resolveBillingAccess({
                      billingStatus: (o.billingStatus || "trial") as "trial" | "active" | "suspended",
                      trialEndsAt: o.trialEndsAt,
                      activatedAt: null,
                      monthlyFeeCents: o.monthlyFeeCents || 0,
                      nextMaintenanceDueAt: o.nextMaintenanceDueAt,
                    })
                  : { status: "trial" as const, trialDaysLeft: 0 };
                return (
                  <tr key={o.id} className="hover:bg-[var(--color-ink-50)] transition-colors">
                    <td className="px-4 py-3 text-[var(--color-ink-500)]">{o.id}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/admin/orgs/${o.id}`} className="hover:underline text-red-700">{o.name || "Unnamed Org"}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[var(--color-ink-900)]">{o.email || "-"}</div>
                      <div className="text-xs text-[var(--color-ink-500)]">{o.phone || "-"}</div>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {([
                          ["CRM", o.crmEnabled],
                          ["Acct", o.accountingEnabled],
                          ["Payroll", o.payrollEnabled],
                        ] as const).map(([label, on]) => (
                          <span
                            key={label}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${
                              on ? "bg-[var(--color-ink-100)] text-[var(--color-ink-700)]" : "bg-[var(--color-ink-50)] text-[var(--color-ink-300)] line-through"
                            }`}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 flex items-center gap-3">
                      <Link href={`/admin/orgs/${o.id}`} className="text-sm font-medium text-[var(--color-ink-600)] hover:underline">Details</Link>
                      <ImpersonateButton orgId={o.id} />
                    </td>
                  </tr>
                );
              })}
              {orgsWithSubs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-ink-500)]">
                    No organizations found.
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
