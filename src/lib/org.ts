import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { db, org, accounts, bankAccounts } from "@/db";
import { eq } from "drizzle-orm";
import { getUser } from "./supabase/server";
import { SEED_ACCOUNTS } from "./coa";

export const orgContext = new AsyncLocalStorage<number>();

export function currentOrgId(): number {
  const id = orgContext.getStore();
  if (id) return id;
  // Scripts (seed/smoke) run outside a request — allow explicit env override.
  if (process.env.BIASHARA_ORG_ID) return Number(process.env.BIASHARA_ORG_ID);
  throw new Error("No organization in context — call within withOrg() or sign in.");
}

export async function getOrg() {
  // Org already resolved (inside withOrg) or script override — load by id, no auth needed.
  const ctxId =
    orgContext.getStore() ??
    (process.env.BIASHARA_ORG_ID ? Number(process.env.BIASHARA_ORG_ID) : undefined);
  if (ctxId) {
    const [row] = await db.select().from(org).where(eq(org.id, ctxId)).limit(1);
    if (row) return row;
  }
  const user = await getUser();
  if (!user) throw new Error("Not authenticated — please sign in.");
  // Super admin impersonation — resolve to the impersonated org, since the
  // admin account typically owns no org of its own.
  if (user.email) {
    const { isSuperAdmin } = await import("./super-admin");
    if (await isSuperAdmin(user.email)) {
      try {
        const { cookies } = await import("next/headers");
        const impersonatedOrgId = (await cookies()).get("impersonated_org_id")?.value;
        if (impersonatedOrgId) {
          const [row] = await db.select().from(org).where(eq(org.id, Number(impersonatedOrgId))).limit(1);
          if (row) return row;
        }
      } catch {
        // outside a request context — fall through
      }
    }
  }
  const [row] = await db.select().from(org).where(eq(org.userId, user.id)).limit(1);
  if (row) return row;
  // Staff member of someone else's org
  const { members } = await import("@/db");
  const { and: andOp } = await import("drizzle-orm");
  const [m] = await db
    .select()
    .from(members)
    .where(andOp(eq(members.userId, user.id), eq(members.active, true)))
    .limit(1);
  if (m) {
    const [memberOrg] = await db.select().from(org).where(eq(org.id, m.orgId)).limit(1);
    if (memberOrg) return memberOrg;
  }
  throw new Error("Organization not found — please complete onboarding.");
}

export async function withOrg<T>(fn: () => Promise<T>, options?: { requireWrite?: boolean }): Promise<T> {
  // Already inside an org context (nested action call) — reuse it.
  if (orgContext.getStore()) {
    if (options?.requireWrite) {
      const { getEntitlements } = await import("./billing-server");
      const ents = await getEntitlements(orgContext.getStore()!);
      if (ents.isReadOnly) throw new Error("Your subscription has expired. Please upgrade to continue creating or editing data.");
    }
    return fn();
  }
  const o = await getOrg();
  if (options?.requireWrite) {
    const { getEntitlements } = await import("./billing-server");
    const ents = await getEntitlements(o.id);
    if (ents.isReadOnly) throw new Error("Your subscription has expired. Please upgrade to continue creating or editing data.");
  }
  return orgContext.run(o.id, fn);
}

/**
 * Per-request memoized version of getOrg.
 * All server-render callers in the same request share one DB hit.
 */
export const getOrgCached = cache(getOrg);

/**
 * Seed a new organization with the Kenyan chart of accounts and default
 * money accounts. Idempotent — skips if the org already has accounts.
 */
export async function seedOrgDefaults(orgId: number) {
  const existing = await db.select().from(accounts).where(eq(accounts.orgId, orgId)).limit(1);
  if (existing.length > 0) return;

  const { subscriptions } = await import("@/db");

  
  await db.insert(subscriptions).values({
    orgId,
    plan: "free",
    paidUntil: "9999-12-31",
    createdAt: new Date().toISOString(),
  });

  const inserted = await db
    .insert(accounts)
    .values(
      SEED_ACCOUNTS.map((a) => ({
        orgId,
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        isSystem: a.system ?? false,
      }))
    )
    .returning();

  const byCode = new Map(inserted.map((a) => [a.code, a.id]));
  await db.insert(bankAccounts).values([
    { orgId, name: "Main Bank Account", kind: "bank", accountId: byCode.get("1000")! },
    { orgId, name: "M-Pesa Till", kind: "mpesa", accountId: byCode.get("1010")! },
    { orgId, name: "Petty Cash", kind: "cash", accountId: byCode.get("1020")! },
  ]);
}
