"use server";

import { db, documentLines, documents, items, accounts, costCenters } from "@/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { postEntry, acct } from "@/lib/posting";
import { todayISO } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

/** Bill/expense lines that posted with no category — the app only added a
 *  Category selector for purchase orders (and made it mandatory everywhere)
 *  after these existed, and they landed in the generic "6900 Misc. expense"
 *  fallback account instead of wherever they actually belonged. Stocked
 *  items are excluded: those always post to Inventory regardless of
 *  category, so a null accountId there was never actually a bug. */
export async function listUncategorizedSpendLines() {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();
    const rows = await db
      .select({
        lineId: documentLines.id,
        documentId: documentLines.documentId,
        description: documentLines.description,
        netCents: documentLines.netCents,
        docNumber: documents.number,
        docType: documents.type,
        docDate: documents.date,
        trackInventory: items.trackInventory,
      })
      .from(documentLines)
      .innerJoin(documents, eq(documents.id, documentLines.documentId))
      .leftJoin(items, eq(items.id, documentLines.itemId))
      .where(and(
        eq(documents.orgId, orgId),
        eq(documents.type, "bill"),
        inArray(documents.status, ["open", "partial", "paid"]),
        isNull(documentLines.accountId),
      ))
      .orderBy(documents.date);
    return rows.filter((r) => !r.trackInventory);
  });
}

export async function listExpenseCategoryOptions() {
  return withOrg(async () => {
    const orgId = currentOrgId();
    return db.select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.type, "expense"), eq(accounts.archived, false)))
      .orderBy(accounts.code);
  });
}

export async function listCostCenterOptions() {
  return withOrg(async () => {
    const orgId = currentOrgId();
    return db.select({ id: costCenters.id, name: costCenters.name }).from(costCenters).where(eq(costCenters.orgId, orgId));
  });
}

/**
 * Assigns the missing category (and cost center, if the org uses them) to a
 * previously-uncategorized bill line, and posts a reclassification entry
 * moving that exact amount out of the 6900 fallback account into the real
 * one — journal_entries is append-only, so this corrects the balance going
 * forward rather than rewriting the original (already-posted) entry.
 */
export async function reconcileSpendLineCategoryAction(lineId: number, accountId: number, costCenterId: number | null): Promise<{ success?: true; error?: string }> {
  try {
    return await withOrg(async () => {
      await requirePerm("accountant");
      const orgId = currentOrgId();
      if (!accountId) throw new Error("Pick a category");

      const [line] = await db
        .select({ line: documentLines, doc: documents })
        .from(documentLines)
        .innerJoin(documents, eq(documents.id, documentLines.documentId))
        .where(and(eq(documentLines.id, lineId), eq(documents.orgId, orgId)))
        .limit(1);
      if (!line) throw new Error("Line not found");
      if (line.line.accountId) throw new Error("This line already has a category — nothing to reconcile");

      const fallbackAccountId = await acct("6900");
      const entryId = await postEntry({
        date: todayISO(),
        memo: `Category reconciliation: ${line.line.description} (${line.doc.number})`,
        sourceType: "category_reconciliation",
        sourceId: line.line.id,
        lines: [
          { accountId, debitCents: line.line.netCents, costCenterId: costCenterId ?? undefined, memo: line.line.description },
          { accountId: fallbackAccountId, creditCents: line.line.netCents, memo: `Reclass off 6900 · ${line.doc.number}` },
        ],
      });

      await db.update(documentLines).set({ accountId, costCenterId }).where(eq(documentLines.id, lineId));

      await logAudit({
        action: "reconcile_category",
        module: "bills",
        recordId: line.doc.id,
        recordLabel: line.doc.number,
        detail: `${line.line.description} reclassified (journal ${entryId})`,
      });

      revalidatePath("/purchases/reconcile-categories");
      revalidatePath("/reports");
      return { success: true };
    });
  } catch (err: any) {
    return { error: err?.message || "Failed to reconcile" };
  }
}
