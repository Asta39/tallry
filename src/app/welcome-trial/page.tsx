import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { WelcomeTrialClient } from "./WelcomeTrialClient";

export const dynamic = "force-dynamic";

export default async function WelcomeTrialPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const access = await getAccess();
  if (!access || !access.orgRow.name) redirect("/onboarding");
  if (access.orgRow.trialWelcomeSeenAt) redirect("/");

  return <WelcomeTrialClient orgName={access.orgRow.name} />;
}
