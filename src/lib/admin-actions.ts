"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";

/** Remove impersonation cookie and redirect back to admin panel. */
export async function stopImpersonating() {
  const user = await getUser();
  if (!user || !user.email) throw new Error("Unauthorized");

  const superAdmins = (process.env.SUPER_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());
  if (!superAdmins.includes(user.email.toLowerCase())) {
    throw new Error("Unauthorized");
  }

  const cookieStore = await cookies();
  cookieStore.delete("impersonated_org_id");
  redirect("/admin");
}
