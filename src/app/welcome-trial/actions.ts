"use server";

import { getUser } from "@/lib/supabase/server";
import { getAccess } from "@/lib/access";
import { db, org } from "@/db";
import { eq } from "drizzle-orm";

export type ModulePreference = "crm" | "crm_accounting" | "crm_payroll" | "all";

/** Marks the welcome screen seen (never shown again) and records the org's
 *  stated module preference, if they picked one. Preference is purely
 *  informational — every active org still gets full access (billing.ts) —
 *  it just tells the sales/support team what to configure or follow up
 *  about once the trial ends. */
export async function completeWelcomeTrialAction(modulePreference: ModulePreference | null) {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  const access = await getAccess();
  if (!access) throw new Error("No organization found");

  await db
    .update(org)
    .set({
      trialWelcomeSeenAt: new Date().toISOString(),
      ...(modulePreference ? { modulePreference } : {}),
    })
    .where(eq(org.id, access.orgId));
}
