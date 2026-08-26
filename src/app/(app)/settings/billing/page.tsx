import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { getEntitlements } from "@/lib/billing-server";
import { db, billingPayments } from "@/db";
import { eq, desc } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { BillingClient } from "./ClientPage";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  await requirePerm("settings");
  const o = await getOrg();
  const entitlements = await getEntitlements(o.id);
  const history = await db
    .select()
    .from(billingPayments)
    .where(eq(billingPayments.orgId, o.id))
    .orderBy(desc(billingPayments.createdAt));

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle="Your account status and maintenance fee payments."
      />
      <div className="mt-8">
        <BillingClient entitlements={entitlements} orgPhone={o.phone || ""} orgEmail={o.email || ""} history={history} />
      </div>
    </>
  );
}
