"use server";

import { db, accounts } from "@/db";
import { eq, and, ne } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { revalidatePath } from "next/cache";

const VALID_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;
type AccountType = (typeof VALID_TYPES)[number];

export async function listAccountsForCoa() {
  return withOrg(() =>
    db.select().from(accounts).where(eq(accounts.orgId, currentOrgId())).orderBy(accounts.code)
  );
}

export async function createAccountAction(data: {
  code: string;
  name: string;
  type: AccountType;
  subtype?: string;
  description?: string;
  parentAccountId?: number | null;
}) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();

    const code = data.code.trim();
    const name = data.name.trim();
    if (!code) throw new Error("Account code is required");
    if (!name) throw new Error("Account name is required");
    if (!VALID_TYPES.includes(data.type)) throw new Error("Invalid account type");

    const [existing] = await db.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.code, code))).limit(1);
    if (existing) throw new Error(`Account code ${code} is already in use`);

    if (data.parentAccountId) {
      const [parent] = await db.select().from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.id, data.parentAccountId))).limit(1);
      if (!parent) throw new Error("Parent account not found");
      if (parent.type !== data.type) throw new Error("A sub-account must have the same type as its parent");
    }

    await db.insert(accounts).values({
      orgId,
      code,
      name,
      type: data.type,
      subtype: data.subtype || "other",
      description: data.description || null,
      parentAccountId: data.parentAccountId || null,
    });
    revalidatePath("/accountant/chart-of-accounts");
    return { success: true };
  });
}

export async function updateAccountAction(id: number, data: {
  name: string;
  subtype?: string;
  description?: string;
  parentAccountId?: number | null;
}) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();

    const [acct] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.id, id))).limit(1);
    if (!acct) throw new Error("Account not found");

    const name = data.name.trim();
    if (!name) throw new Error("Account name is required");

    if (data.parentAccountId) {
      if (data.parentAccountId === id) throw new Error("An account can't be its own parent");
      const [parent] = await db.select().from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.id, data.parentAccountId))).limit(1);
      if (!parent) throw new Error("Parent account not found");
      if (parent.type !== acct.type) throw new Error("A sub-account must have the same type as its parent");
      // Prevent cycles: walk up the new parent's chain and make sure `id` doesn't appear
      let cursor: number | null = data.parentAccountId;
      const seen = new Set<number>();
      while (cursor) {
        if (cursor === id) throw new Error("That would create a circular hierarchy");
        if (seen.has(cursor)) break;
        seen.add(cursor);
        const [row] = await db.select({ parentAccountId: accounts.parentAccountId }).from(accounts)
          .where(and(eq(accounts.orgId, orgId), eq(accounts.id, cursor))).limit(1);
        cursor = row?.parentAccountId ?? null;
      }
    }

    // Type is intentionally immutable once created — changing it would silently
    // flip the sign convention (accountBalances.debitNature) for every historical
    // journal line already posted to this account.
    await db.update(accounts).set({
      name,
      subtype: data.subtype || acct.subtype,
      description: data.description ?? acct.description,
      parentAccountId: data.parentAccountId ?? null,
    }).where(eq(accounts.id, id));
    revalidatePath("/accountant/chart-of-accounts");
    return { success: true };
  });
}

export async function archiveAccountAction(id: number, archived: boolean) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();

    const [acct] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.id, id))).limit(1);
    if (!acct) throw new Error("Account not found");
    if (acct.isSystem) throw new Error("System accounts can't be archived");

    if (archived) {
      // Archiving is safe even with ledger history — it just hides the account
      // from new-entry pickers, past reports still show it. Only block if it's
      // still in active use as another account's parent.
      const [child] = await db.select({ id: accounts.id }).from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.parentAccountId, id), ne(accounts.archived, true))).limit(1);
      if (child) throw new Error("Archive or reassign its sub-accounts first");
    }

    await db.update(accounts).set({ archived }).where(eq(accounts.id, id));
    revalidatePath("/accountant/chart-of-accounts");
    return { success: true };
  });
}
