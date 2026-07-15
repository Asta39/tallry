import { getEntitlements } from "@/lib/billing-server";
import { getOrg } from "@/lib/org";
import { UpgradePrompt } from "@/components/UpgradePrompt";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const orgRow = await getOrg();
  const ents = await getEntitlements(orgRow.id);

  return (
    <UpgradePrompt 
      isLocked={!ents.limits.portal} 
      featureName="Customer Portal" 
      description="Give your clients a branded self-service portal to view invoices, download statements, and make payments online."
    >
      {children}
    </UpgradePrompt>
  );
}
