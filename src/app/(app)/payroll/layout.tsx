import { getEntitlements } from "@/lib/billing-server";
import { getOrg } from "@/lib/org";
import { UpgradePrompt } from "@/components/UpgradePrompt";

export default async function PayrollLayout({ children }: { children: React.ReactNode }) {
  const orgRow = await getOrg();
  const ents = await getEntitlements(orgRow.id);

  return (
    <UpgradePrompt 
      isLocked={!ents.limits.payroll} 
      featureName="Payroll" 
      description="Streamline your HR processes, run automatic payrolls, and generate KRA-compliant payslips with our full Payroll module."
    >
      {children}
    </UpgradePrompt>
  );
}
