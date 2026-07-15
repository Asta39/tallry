import { getEntitlements } from "@/lib/billing-server";
import { getOrg } from "@/lib/org";
import { UpgradePrompt } from "@/components/UpgradePrompt";

export default async function GatewaysLayout({ children }: { children: React.ReactNode }) {
  const orgRow = await getOrg();
  const ents = await getEntitlements(orgRow.id);

  return (
    <UpgradePrompt 
      isLocked={!ents.limits.gateways} 
      featureName="Payment Gateways" 
      description="Accept M-Pesa, Till Number, and Paybill payments directly on your invoices automatically matching them to client accounts."
    >
      {children}
    </UpgradePrompt>
  );
}
