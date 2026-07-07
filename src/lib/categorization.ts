import { db, categorizationRules, bankTransactions } from "@/db";
import { and, eq, desc } from "drizzle-orm";
import { currentOrgId } from "./org";
import { nowISO } from "./money";

/**
 * Learnable bank-categorization rules.
 * A rule = "descriptions containing <keyword> and going <direction> → book to
 * <account>". Saved automatically when the user categorizes a transaction, then
 * used to pre-fill categories on future imports.
 */

const STOP = new Set([
  "pay", "bill", "to", "from", "the", "and", "for", "of", "acc", "account", "ltd",
  "limited", "co", "company", "payment", "customer", "merchant", "transfer",
  "mpesa", "m-pesa", "kes", "ksh", "via", "buy", "goods", "services", "till",
  "paybill", "sent", "received", "withdraw", "deposit", "transaction",
]);

/**
 * Derive a stable match keyword from a transaction description — the merchant
 * / payee token. e.g. "Pay Bill to KPLC PREPAID Acc. 123 · SFG…" → "kplc".
 */
export function deriveKeyword(description: string): string | null {
  const cleaned = description
    .toLowerCase()
    .replace(/·.*/g, " ") // drop the receipt suffix we append
    .replace(/\b[a-z0-9]{10}\b/g, " ") // drop receipt codes
    .replace(/\b\d[\d,.]*\b/g, " ") // drop numbers
    .replace(/[^a-z\s]/g, " ");
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
  if (words.length === 0) return null;
  // The merchant/payee name comes first in M-Pesa descriptions
  // ("Pay Bill to KPLC PREPAID…" → "kplc", "…to NAIVAS SUPERMARKET" → "naivas").
  return words[0];
}

/** Upsert a rule learned from a user categorization. */
export async function learnRule(description: string, direction: "in" | "out", categoryAccountId: number) {
  const keyword = deriveKeyword(description);
  if (!keyword) return;
  const orgId = currentOrgId();
  const [existing] = await db
    .select()
    .from(categorizationRules)
    .where(
      and(
        eq(categorizationRules.orgId, orgId),
        eq(categorizationRules.keyword, keyword),
        eq(categorizationRules.direction, direction)
      )
    )
    .limit(1);
  if (existing) {
    // Update the target if it changed, bump hit count
    await db
      .update(categorizationRules)
      .set({ categoryAccountId, hits: existing.hits + 1 })
      .where(eq(categorizationRules.id, existing.id));
  } else {
    await db
      .insert(categorizationRules)
      .values({ orgId, keyword, direction, categoryAccountId, hits: 1, createdAt: nowISO() });
  }
}

export async function listRules() {
  return db
    .select()
    .from(categorizationRules)
    .where(eq(categorizationRules.orgId, currentOrgId()))
    .orderBy(desc(categorizationRules.hits));
}

export async function deleteRule(ruleId: number) {
  await db
    .delete(categorizationRules)
    .where(and(eq(categorizationRules.orgId, currentOrgId()), eq(categorizationRules.id, ruleId)));
}

/**
 * Suggest a category for each uncategorized transaction using saved rules.
 * Longest-keyword match wins (most specific). Returns { txnId: accountId }.
 */
export async function suggestCategories(
  txns: { id: number; description: string; amountCents: number }[]
): Promise<Record<number, number>> {
  const rules = await listRules();
  const out: Record<number, number> = {};
  for (const t of txns) {
    const dir = t.amountCents >= 0 ? "in" : "out";
    const desc = t.description.toLowerCase();
    const matches = rules
      .filter((r) => r.direction === dir && desc.includes(r.keyword))
      .sort((a, b) => b.keyword.length - a.keyword.length || b.hits - a.hits);
    if (matches[0]) out[t.id] = matches[0].categoryAccountId;
  }
  return out;
}

/** Apply all saved rules to currently-uncategorized transactions in one pass. */
export async function applyRulesToUncategorized(): Promise<{ txnId: number; categoryAccountId: number }[]> {
  const orgId = currentOrgId();
  const uncategorized = await db
    .select()
    .from(bankTransactions)
    .where(and(eq(bankTransactions.orgId, orgId), eq(bankTransactions.status, "uncategorized")));
  const suggestions = await suggestCategories(uncategorized);
  return Object.entries(suggestions).map(([txnId, categoryAccountId]) => ({
    txnId: Number(txnId),
    categoryAccountId,
  }));
}
