import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { getPlatformSettings } from "@/lib/platform-settings";
import { WelcomeTrialClient } from "./WelcomeTrialClient";

export const dynamic = "force-dynamic";

export default async function WelcomeTrialPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const access = await getAccess();
  if (!access || !access.orgRow.name) redirect("/onboarding");
  if (access.orgRow.trialWelcomeSeenAt) redirect("/home");

  const { trialDays, perStaffMonthlyFeeCents } = await getPlatformSettings();

  return <WelcomeTrialClient orgName={access.orgRow.name} trialDays={trialDays} perStaffFeeKes={perStaffMonthlyFeeCents / 100} />;
}
