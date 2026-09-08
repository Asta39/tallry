import { db, orgAdminNotes } from "@/db";
import { eq, desc } from "drizzle-orm";

/** Plain server-only read — no "use server" here since it's not a mutation;
 *  the action that pairs with it lives in admin/actions.ts (see the
 *  platform-settings.ts split for why client/server exports can't mix). */
export async function listOrgNotes(orgId: number) {
  return db.select().from(orgAdminNotes).where(eq(orgAdminNotes.orgId, orgId)).orderBy(desc(orgAdminNotes.id));
}
