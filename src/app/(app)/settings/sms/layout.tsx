import { getEntitlements } from "@/lib/billing-server";
import { getOrg } from "@/lib/org";
import { UpgradePrompt } from "@/components/UpgradePrompt";

export default async function SmsLayout({ children }: { children: React.ReactNode }) {
  const orgRow = await getOrg();
  const ents = await getEntitlements(orgRow.id);

  return (
    <UpgradePrompt 
      isLocked={!ents.limits.sms} 
      featureName="SMS Integration" 
      description="Connect your Advanta SMS credentials to send invoices, receipts, and automatic payment reminders to clients via SMS."
    >
      {children}
    </UpgradePrompt>
  );
}
