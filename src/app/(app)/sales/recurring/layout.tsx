import { getEntitlements } from "@/lib/billing-server";
import { getOrg } from "@/lib/org";
import { UpgradePrompt } from "@/components/UpgradePrompt";

export default async function RecurringLayout({ children }: { children: React.ReactNode }) {
  const orgRow = await getOrg();
  const ents = await getEntitlements(orgRow.id);

  return (
    <UpgradePrompt 
      isLocked={!ents.limits.recurring} 
      featureName="Recurring Invoices" 
      description="Automate your billing by creating templates that automatically issue invoices on a schedule you define."
    >
      {children}
    </UpgradePrompt>
  );
}
