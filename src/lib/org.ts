import { AsyncLocalStorage } from "node:async_hooks";
import { db, org } from "@/db";
import { eq } from "drizzle-orm";
import { getUser } from "./supabase/server";

export const orgContext = new AsyncLocalStorage<number>();

export function currentOrgId(): number {
  const id = orgContext.getStore();
  if (!id) {
    console.error("No orgId in async context. Returning 0 fallback.");
    return 0;
  }
  return id;
}

export async function getOrg() {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated — please sign in.");
  const [row] = await db.select().from(org).where(eq(org.userId, user.id)).limit(1);
  if (!row) throw new Error("Organization not found — please complete onboarding.");
  return row;
}

export async function withOrg<T>(fn: () => Promise<T>): Promise<T> {
  const o = await getOrg();
  return orgContext.run(o.id, fn);
}
