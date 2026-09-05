"use server";

import { db, accounts, bankAccounts, items } from "@/db";
import { eq, and, ne } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { postEntry, acct } from "@/lib/posting";
import { SYS } from "@/lib/coa";
import { accountBalances } from "@/lib/reports";
import { todayISO } from "@/lib/money";
import { buildBalanceAdjustmentLines } from "@/lib/account-balance-adjustments";

const VALID_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;
type AccountType = (typeof VALID_TYPES)[number];

import { ensureExpandedChartOfAccounts } from "@/lib/org";

export async function listAccountsForCoa() {
  return withOrg(async () => {
    const orgId = currentOrgId();
    await ensureExpandedChartOfAccounts(orgId);
    return db.select().from(accounts).where(eq(accounts.orgId, orgId)).orderBy(accounts.code);
  });
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

const MONEY_ACCOUNT_KINDS = ["bank", "mpesa", "cash", "card"] as const;
type MoneyAccountKind = (typeof MONEY_ACCOUNT_KINDS)[number];

/**
 * Adds a new money account (Bank & M-Pesa) — e.g. a second M-Pesa-type
 * account like Pochi la Biashara, kept separate from the till so its
 * balance, reconciliation and reporting are distinct. There was previously
 * no way to add one after org signup; the three seeded accounts (Main Bank,
 * M-Pesa Till, Petty Cash) were it. Creates the linked Chart-of-Accounts
 * asset account the same way onboarding does (src/lib/org.ts), slotting its
 * code into the 1000-1049 cash/bank block reserved by SEED_ACCOUNTS.
 */
export async function createMoneyAccountAction(data: { name: string; kind: MoneyAccountKind }) {
  return withOrg(async () => {
    const access = await requirePerm("banking");
    if (!access.isOwner && access.role !== "admin" && access.role !== "accountant") {
      throw new Error("Only the owner, an admin, or an accountant can add a money account");
    }
    const orgId = currentOrgId();
    const name = data.name.trim();
    if (!name) throw new Error("Account name is required");
    if (!MONEY_ACCOUNT_KINDS.includes(data.kind)) throw new Error("Invalid account type");

    const existingCodes = (await db.select({ code: accounts.code }).from(accounts).where(eq(accounts.orgId, orgId)))
      .map((a) => Number(a.code))
      .filter((n) => Number.isFinite(n) && n >= 1000 && n < 1050);
    let code = existingCodes.length > 0 ? Math.max(...existingCodes) + 10 : 1030;
    // Guard against landing on/past the next reserved block (Undeposited
    // Funds, 1050) or an already-used code from a non-standard import.
    const taken = new Set((await db.select({ code: accounts.code }).from(accounts).where(eq(accounts.orgId, orgId))).map((a) => a.code));
    while (code >= 1050 || taken.has(String(code))) code++;

    const [account] = await db.insert(accounts).values({
      orgId,
      code: String(code),
      name,
      type: "asset",
      subtype: data.kind === "cash" ? "cash" : "bank",
      description: `Money account added from Bank & M-Pesa (${name}).`,
    }).returning();

    const [bank] = await db.insert(bankAccounts).values({ orgId, name, kind: data.kind, accountId: account.id }).returning();

    revalidatePath("/banking");
    return { id: bank.id };
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

async function assertBalanceAdjustableAccount(accountId: number) {
  const orgId = currentOrgId();
  const [account] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.id, accountId))).limit(1);
  if (!account) throw new Error("Account not found");
  if (account.isSystem) throw new Error("System-managed accounts can't be adjusted here");

  const [bankLink] = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.accountId, accountId), eq(bankAccounts.archived, false)))
    .limit(1);
  if (bankLink) throw new Error("Accounts linked to bank, cash, or M-Pesa are updated by banking modules");

  const [purchaseItemLink] = await db
    .select({ id: items.id })
    .from(items)
    .where(and(
      eq(items.orgId, orgId),
      eq(items.archived, false),
      eq(items.purchaseAccountId, accountId),
    ))
    .limit(1);
  const [salesItemLink] = await db
    .select({ id: items.id })
    .from(items)
    .where(and(
      eq(items.orgId, orgId),
      eq(items.archived, false),
      eq(items.salesAccountId, accountId),
    ))
    .limit(1);
  if (purchaseItemLink || salesItemLink) {
    throw new Error("Accounts linked to items are updated by sales and purchase flows");
  }

  return account;
}

export async function adjustAccountBalanceAction(data: {
  accountId: number;
  targetBalanceCents: number;
  memo?: string;
}) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const account = await assertBalanceAdjustableAccount(data.accountId);
    const balances = await accountBalances({});
    const currentBalanceCents = balances.find((row) => row.accountId === data.accountId)?.balanceCents ?? 0;
    const delta = data.targetBalanceCents - currentBalanceCents;
    if (delta === 0) return { success: true };

    const openingBalanceAccountId = await acct(SYS.OPENING_BALANCE);
    await postEntry({
      date: todayISO(),
      memo: (data.memo || `Balance adjustment for ${account.name}`).trim(),
      sourceType: "manual_balance_adjustment",
      lines: buildBalanceAdjustmentLines({
        accountId: account.id,
        accountType: account.type,
        offsetAccountId: openingBalanceAccountId,
        deltaCents: delta,
      }),
    });

    revalidatePath("/accountant");
    revalidatePath(`/accountant/ledger/${account.id}`);
    return { success: true };
  }, { requireWrite: true });
}
