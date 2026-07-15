"use server";

import { db, portalUsers } from "@/db";
import { eq, and } from "drizzle-orm";
import { createClientSession } from "@/lib/client-portal/auth";
import crypto from "crypto";
import { getOrgBySlug } from "@/lib/portal";

export async function portalLoginAction(slug: string, email: string, password: string) {
  const o = await getOrgBySlug(slug);
  if (!o) return { error: "Organization not found" };

  const [user] = await db.select()
    .from(portalUsers)
    .where(and(eq(portalUsers.orgId, o.id), eq(portalUsers.email, email)))
    .limit(1);

  if (!user || !user.isActive) {
    return { error: "Invalid email or password" };
  }

  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
  if (user.passwordHash !== passwordHash) {
    return { error: "Invalid email or password" };
  }

  await createClientSession(o.id, user.id, user.contactId, slug);
  return { success: true };
}
