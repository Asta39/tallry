"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/super-admin";

/** Remove impersonation cookie and redirect back to admin panel. */
export async function stopImpersonating() {
  await requireSuperAdmin();

  const cookieStore = await cookies();
  cookieStore.delete("impersonated_org_id");
  redirect("/admin");
}
