import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { db, org, accounts, bankAccounts } from "@/db";
import { eq } from "drizzle-orm";
import { getUser } from "./supabase/server";
import { SEED_ACCOUNTS } from "./coa";

async function reportInvoiceIssueDebug(hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) {
  // #region debug-point D:org-logger
  try {
    const { readFile } = await import("node:fs/promises");
    const env = await readFile(".dbg/invoice-issue-500.env", "utf8").catch(() => "");
    const url = env.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || "http://127.0.0.1:7777/event";
    const sessionId = env.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || "invoice-issue-500";
    await fetch(url, {
      method: "POST",
      body: JSON.stringify({ sessionId, runId: "pre-fix", hypothesisId, location, msg: `[DEBUG] ${msg}`, data, ts: Date.now() }),
    }).catch(() => {});
  } catch {}
  // #endregion
}

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
    // #region debug-point D:with-org-nested
    await reportInvoiceIssueDebug("D", "src/lib/org.ts:withOrg:nested", "withOrg reusing existing org context", {
      orgId: orgContext.getStore()!,
      requireWrite: !!options?.requireWrite,
    });
    // #endregion
    if (options?.requireWrite) {
      const { getEntitlements } = await import("./billing-server");
      const ents = await getEntitlements(orgContext.getStore()!);
      // #region debug-point D:with-org-nested-entitlements
      await reportInvoiceIssueDebug("D", "src/lib/org.ts:withOrg:nested:entitlements", "checked nested write entitlements", {
        orgId: orgContext.getStore()!,
        isReadOnly: ents.isReadOnly,
        status: ents.status,
        plan: ents.plan,
        subscriptionPlan: ents.subscriptionPlan,
      });
      // #endregion
      if (ents.isReadOnly) throw new Error("Your subscription has expired. Please upgrade to continue creating or editing data.");
    }
    return fn();
  }
  // #region debug-point D:with-org-start
  await reportInvoiceIssueDebug("D", "src/lib/org.ts:withOrg:start", "withOrg resolving organization", {
    requireWrite: !!options?.requireWrite,
  });
  // #endregion
  const o = await getOrg();
  // #region debug-point D:with-org-resolved
  await reportInvoiceIssueDebug("D", "src/lib/org.ts:withOrg:resolved", "withOrg resolved organization", {
    orgId: o.id,
    requireWrite: !!options?.requireWrite,
  });
  // #endregion
  if (options?.requireWrite) {
    const { getEntitlements } = await import("./billing-server");
    const ents = await getEntitlements(o.id);
    // #region debug-point D:with-org-entitlements
    await reportInvoiceIssueDebug("D", "src/lib/org.ts:withOrg:entitlements", "checked write entitlements", {
      orgId: o.id,
      isReadOnly: ents.isReadOnly,
      status: ents.status,
      plan: ents.plan,
      subscriptionPlan: ents.subscriptionPlan,
    });
    // #endregion
    if (ents.isReadOnly) throw new Error("Your subscription has expired. Please upgrade to continue creating or editing data.");
  }
  // #region debug-point D:with-org-run
  await reportInvoiceIssueDebug("D", "src/lib/org.ts:withOrg:run", "entering org context callback", {
    orgId: o.id,
  });
  // #endregion
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
        description: a.description,
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

/** Ensure existing organizations also have descriptions and expanded seed accounts. */
export async function ensureExpandedChartOfAccounts(orgId: number) {
  const existing = await db.select().from(accounts).where(eq(accounts.orgId, orgId));
  const existingCodes = new Map(existing.map((a) => [a.code, a]));

  for (const s of SEED_ACCOUNTS) {
    const acct = existingCodes.get(s.code);
    if (!acct) {
      await db.insert(accounts).values({
        orgId,
        code: s.code,
        name: s.name,
        type: s.type,
        subtype: s.subtype,
        description: s.description,
        isSystem: s.system ?? false,
      });
    } else if (!acct.description && s.description) {
      await db.update(accounts).set({ description: s.description }).where(eq(accounts.id, acct.id));
    }
  }
}
