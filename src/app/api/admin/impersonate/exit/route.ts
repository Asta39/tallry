import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/super-admin";
import { logAdminAction } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";

/**
 * Stop impersonating and go straight to the admin panel. This used to be a
 * server action called from inside the impersonated org's pages, so after the
 * cookie was cleared Next re-rendered that org page for a super admin who no
 * longer had an org: slow (the whole dashboard ran again) and it often threw,
 * landing on the "Application Error" screen. A form POST + 303 skips that.
 */
export async function POST(req: NextRequest) {
  const user = await getUser();
  const orgId = req.cookies.get("impersonated_org_id")?.value;
  const res = NextResponse.redirect(new URL(user?.email && (await isSuperAdmin(user.email)) ? "/admin" : "/login", req.url), 303);
  res.cookies.delete("impersonated_org_id");
  if (user?.email && orgId) {
    await logAdminAction({ actorEmail: user.email, action: "impersonate_stop", targetType: "org", targetId: orgId });
  }
  return res;
}
