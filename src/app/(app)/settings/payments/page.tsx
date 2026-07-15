import { getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { db, paymentGateways } from "@/db";
import { eq, and } from "drizzle-orm";
import { decryptConfig } from "@/lib/payments/crypto";
import { PageHeader } from "@/components/ui";
import { PaymentGatewayForm } from "./PaymentGatewayForm";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { getEntitlements } from "@/lib/billing-server";

export const dynamic = "force-dynamic";

export default async function PaymentsSettingsPage() {
  await requirePerm("settings");
  const o = await getOrg();
  const user = await getUser();
  if (!user || !o) redirect("/login");

  const entitlements = await getEntitlements(o.id);
  const isLocked = !entitlements.limits.gateways;

  const gateways = await db.select().from(paymentGateways).where(eq(paymentGateways.orgId, o.id));

  // The client component will handle the masked state
  const gatewaysState = gateways.map(g => {
    const conf = decryptConfig(g.configJson);
    const { webhookSecret: _secret, ...safe } = g; // never send to client
    return {
      ...safe,
      config: {
        shortcode: conf?.shortcode || "",
        tillNumber: conf?.tillNumber || "",
        hasSecrets: !!g.configJson,
      },
      configJson: g.configJson ? "********" : "" // Don't send real config back to client
    };
  });

  return (
    <UpgradePrompt 
      isLocked={isLocked} 
      featureName="Payment Gateways" 
      description="Automated payment integrations like M-Pesa are available on Standard and Business plans."
    >
      <div className="max-w-4xl mx-auto pb-12 min-h-[70vh]">
        <PageHeader
          title="Payment Gateways"
          subtitle="Configure incoming and outgoing payment integrations"
        />

        <div className="mt-8 space-y-8">
          <PaymentGatewayForm gateways={gatewaysState} />
        </div>
      </div>
    </UpgradePrompt>
  );
}
