"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";

export { stopImpersonating } from "@/lib/admin-actions";

export async function impersonateOrg(orgId: number) {
  const user = await getUser();
  if (!user || !user.email) throw new Error("Unauthorized");
  
  const superAdmins = (process.env.SUPER_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());
  if (!superAdmins.includes(user.email.toLowerCase())) {
    throw new Error("Unauthorized");
  }

  const cookieStore = await cookies();
  cookieStore.set("impersonated_org_id", String(orgId), { path: "/" });
  
  redirect("/");
}
