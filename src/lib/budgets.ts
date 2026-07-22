"use server";

import { db, budgets, budgetLines, accounts } from "@/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { nowISO } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { profitAndLoss } from "@/lib/reports";

export async function listBudgets() {
  return withOrg(() => db.select().from(budgets).where(eq(budgets.orgId, currentOrgId())).orderBy(desc(budgets.fiscalYear), desc(budgets.id)));
}

export async function createBudgetAction(data: { name: string; fiscalYear: string }) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const name = data.name.trim();
    if (!name) throw new Error("Name is required");
    if (!/^\d{4}$/.test(data.fiscalYear)) throw new Error("Enter a valid 4-digit year");
    const [row] = await db.insert(budgets).values({ orgId: currentOrgId(), name, fiscalYear: data.fiscalYear, createdAt: nowISO() }).returning();
    revalidatePath("/accounting/budgets");
    return { id: row.id };
  });
}

export async function deleteBudgetAction(id: number) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();
    const [b] = await db.select().from(budgets).where(and(eq(budgets.orgId, orgId), eq(budgets.id, id))).limit(1);
    if (!b) throw new Error("Budget not found");
    await db.delete(budgetLines).where(eq(budgetLines.budgetId, id));
    await db.delete(budgets).where(eq(budgets.id, id));
    revalidatePath("/accounting/budgets");
    return { success: true };
  });
}

/** Income + expense accounts, the only types a P&L budget makes sense for. */
export async function listBudgetableAccounts() {
  return withOrg(() =>
    db.select().from(accounts).where(and(eq(accounts.orgId, currentOrgId()), inArray(accounts.type, ["income", "expense"]), eq(accounts.archived, false))).orderBy(accounts.code)
  );
}

export async function getBudget(id: number) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const [budget] = await db.select().from(budgets).where(and(eq(budgets.orgId, orgId), eq(budgets.id, id))).limit(1);
    if (!budget) return null;
    const lines = await db.select().from(budgetLines).where(and(eq(budgetLines.orgId, orgId), eq(budgetLines.budgetId, id)));
    return { budget, lines };
  });
}

/** Replace all lines for a budget with the given set (bulk upsert via delete+reinsert, same pattern as document lines). */
export async function saveBudgetLinesAction(budgetId: number, lines: { accountId: number; month: string; amountCents: number }[]) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();
    const [budget] = await db.select().from(budgets).where(and(eq(budgets.orgId, orgId), eq(budgets.id, budgetId))).limit(1);
    if (!budget) throw new Error("Budget not found");

    for (const l of lines) {
      if (!/^\d{4}-\d{2}$/.test(l.month)) throw new Error(`Invalid month: ${l.month}`);
      if (l.amountCents < 0) throw new Error("Budget amounts can't be negative");
    }

    await db.delete(budgetLines).where(eq(budgetLines.budgetId, budgetId));
    const nonZero = lines.filter((l) => l.amountCents !== 0);
    if (nonZero.length > 0) {
      await db.insert(budgetLines).values(nonZero.map((l) => ({ orgId, budgetId, accountId: l.accountId, month: l.month, amountCents: l.amountCents })));
    }
    revalidatePath(`/accounting/budgets/${budgetId}`);
    return { success: true };
  });
}

/** Budget vs. actual for the whole fiscal year, per account. */
export async function getBudgetVsActual(budgetId: number) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const [budget] = await db.select().from(budgets).where(and(eq(budgets.orgId, orgId), eq(budgets.id, budgetId))).limit(1);
    if (!budget) throw new Error("Budget not found");

    const lines = await db.select().from(budgetLines).where(and(eq(budgetLines.orgId, orgId), eq(budgetLines.budgetId, budgetId)));
    const allAccounts = await db.select().from(accounts).where(eq(accounts.orgId, orgId));
    const accountById = new Map(allAccounts.map((a) => [a.id, a]));

    const budgetByAccount = new Map<number, number>();
    for (const l of lines) budgetByAccount.set(l.accountId, (budgetByAccount.get(l.accountId) || 0) + l.amountCents);

    const pl = await profitAndLoss(`${budget.fiscalYear}-01-01`, `${budget.fiscalYear}-12-31`);
    const actualByAccount = new Map<number, number>();
    for (const b of [...pl.income, ...pl.cogs, ...pl.expenses]) actualByAccount.set(b.accountId, b.balanceCents);

    const accountIds = new Set([...budgetByAccount.keys(), ...actualByAccount.keys()]);
    const rows = Array.from(accountIds)
      .map((accountId) => {
        const a = accountById.get(accountId);
        const budgetCents = budgetByAccount.get(accountId) || 0;
        const actualCents = actualByAccount.get(accountId) || 0;
        return {
          accountId,
          code: a?.code || "",
          name: a?.name || `Account #${accountId}`,
          type: a?.type || "",
          budgetCents,
          actualCents,
          varianceCents: actualCents - budgetCents,
        };
      })
      .sort((x, y) => x.code.localeCompare(y.code));

    return { budget, rows };
  });
}
