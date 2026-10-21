import { NextResponse, type NextRequest } from "next/server";
import { db, org } from "@/db";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/super-admin";
import { logAdminAction } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";

/**
 * Start impersonating an org: set the cookie and send the browser straight
 * to the org's dashboard. A plain form POST + 303 instead of a server action:
 * an action re-renders the page it was called from before the browser moves
 * on, which made switching slow and could fail mid-render. POST only, and the
 * session cookie is SameSite=Lax, so another site can't trigger this.
 */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user?.email || !(await isSuperAdmin(user.email))) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }
  const form = await req.formData();
  const orgId = Number(form.get("orgId"));
  const [row] = Number.isInteger(orgId) && orgId > 0 ? await db.select({ id: org.id }).from(org).where(eq(org.id, orgId)).limit(1) : [];
  if (!row) return NextResponse.redirect(new URL("/admin/orgs", req.url), 303);

  await logAdminAction({ actorEmail: user.email, action: "impersonate_start", targetType: "org", targetId: orgId });
  const res = NextResponse.redirect(new URL("/home", req.url), 303);
  // Auto-expires after 1 hour so an impersonation session can't linger forever.
  res.cookies.set("impersonated_org_id", String(orgId), { path: "/", maxAge: 60 * 60, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
