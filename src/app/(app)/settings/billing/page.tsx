import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { getEntitlements } from "@/lib/billing-server";
import { PageHeader } from "@/components/ui";
import { BillingClient } from "./ClientPage";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  await requirePerm("settings");
  const o = await getOrg();
  const entitlements = await getEntitlements(o.id);

  return (
    <>
      <PageHeader
        title="Billing & Subscription"
        subtitle="Manage your Tallry plan and usage limits."
      />
      <div className="mt-8">
        <BillingClient entitlements={entitlements} />
      </div>
    </>
  );
}
