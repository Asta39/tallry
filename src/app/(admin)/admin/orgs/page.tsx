export const dynamic = "force-dynamic";

import { db, org, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { resolveBillingAccess } from "@/lib/billing";
import { OrgsListClient } from "./OrgsListClient";

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

  const rows = orgsWithSubs.map((o) => {
    const billing = o.trialEndsAt
      ? resolveBillingAccess({
          billingStatus: (o.billingStatus || "trial") as "trial" | "active" | "suspended",
          trialEndsAt: o.trialEndsAt,
          activatedAt: null,
          monthlyFeeCents: o.monthlyFeeCents || 0,
          nextMaintenanceDueAt: o.nextMaintenanceDueAt,
        })
      : { status: "trial" as const, trialDaysLeft: 0 };
    return {
      id: o.id,
      name: o.name,
      email: o.email,
      phone: o.phone,
      crmEnabled: o.crmEnabled,
      accountingEnabled: o.accountingEnabled,
      payrollEnabled: o.payrollEnabled,
      billing,
      rawBillingStatus: o.billingStatus,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">Manage all tenants on the platform.</p>
      </div>
      <OrgsListClient rows={rows} />
    </div>
  );
}
