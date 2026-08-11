"use server";

import { db, documents, documentLines, accounts, costCenters, items } from "@/db";
import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { postEntry, acct } from "@/lib/posting";
import { SYS } from "@/lib/coa";
import { todayISO, fmtKES } from "@/lib/money";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

/** Posted (not draft/void) invoice/bill/expense lines that never got a real
 *  category — they landed on the generic fallback account (Sales for
 *  invoices, "6900" for bills/expenses) instead of the category the
 *  accountant meant. Lets the accountant assign the right account after the
 *  fact and reclass the ledger to match, without touching document totals. */
export async function listUncategorizedLines() {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();
    const rows = await db
      .select({
        lineId: documentLines.id,
        documentId: documents.id,
        docType: documents.type,
        docNumber: documents.number,
        docDate: documents.date,
        description: documentLines.description,
        netCents: documentLines.netCents,
        costCenterId: documentLines.costCenterId,
      })
      .from(documentLines)
      .innerJoin(documents, eq(documents.id, documentLines.documentId))
      .leftJoin(items, eq(items.id, documentLines.itemId))
      .where(and(
        eq(documents.orgId, orgId),
        isNull(documentLines.accountId),
        inArray(documents.type, ["invoice", "bill", "expense"]),
        ne(documents.status, "draft"),
        ne(documents.status, "void"),
        // Tracked-inventory lines never actually land on the generic
        // fallback account — postBill/postExpense silently overrides them
        // to Inventory Asset regardless of accountId. Offering one here lets
        // the accountant "reclass" it off a fallback it was never posted to,
        // crediting that fallback into a bogus negative balance while
        // overstating whatever account they pick (this produced org 33's
        // impossible negative Miscellaneous Expenses balance).
        or(isNull(documentLines.itemId), eq(items.trackInventory, false)),
      ))
      .orderBy(documents.date);
    return rows;
  });
}

export async function categoryAccountOptions() {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();
    const rows = await db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), inArray(accounts.type, ["income", "expense"]), eq(accounts.archived, false)))
      .orderBy(accounts.code);
    return rows;
  });
}

export async function costCenterOptions() {
  return withOrg(async () => {
    const orgId = currentOrgId();
    return db.select({ id: costCenters.id, name: costCenters.name }).from(costCenters).where(and(eq(costCenters.orgId, orgId), eq(costCenters.active, true))).orderBy(costCenters.name);
  });
}

/** Assigns the right account (and optionally cost center) to a single line
 *  that was posted against the generic fallback, and posts a reclass entry
 *  moving that line's amount off the fallback account onto the real one —
 *  the document's own totals/journal-entry-of-record are never touched. */
export async function reclassLineAction(lineId: number, newAccountId: number, newCostCenterId?: number | null): Promise<{ success?: true; error?: string }> {
  try {
    return await withOrg(async () => {
      await requirePerm("accountant");
      const orgId = currentOrgId();

      const [row] = await db
        .select({
          docId: documents.id,
          docType: documents.type,
          docNumber: documents.number,
          netCents: documentLines.netCents,
          accountId: documentLines.accountId,
          trackInventory: items.trackInventory,
        })
        .from(documentLines)
        .innerJoin(documents, eq(documents.id, documentLines.documentId))
        .leftJoin(items, eq(items.id, documentLines.itemId))
        .where(and(eq(documents.orgId, orgId), eq(documentLines.id, lineId)))
        .limit(1);
      if (!row) throw new Error("Line not found");
      if (row.accountId) throw new Error("This line already has a category");
      if (row.trackInventory) throw new Error("Tracked-inventory lines post to Inventory Asset automatically — they were never on the fallback account, so there's nothing to reclass");

      const [target] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.id, newAccountId))).limit(1);
      if (!target) throw new Error("Account not found");

      const fallbackAccountId = row.docType === "invoice"
        ? await acct(SYS.SALES)
        : await acct("6900");

      if (fallbackAccountId !== newAccountId) {
        // Invoices credit Sales on the way in (income); bills/expenses debit
        // the expense account — reclassing swaps that same side between the
        // fallback and the chosen account, net zero, debits still equal credits.
        const isIncome = row.docType === "invoice";
        await postEntry({
          date: todayISO(),
          memo: `Reclass: ${row.docNumber} line moved to ${target.code} · ${target.name}`,
          sourceType: "line_reclassification",
          sourceId: row.docId,
          lines: isIncome
            ? [
                { accountId: fallbackAccountId, debitCents: row.netCents },
                { accountId: newAccountId, creditCents: row.netCents },
              ]
            : [
                { accountId: newAccountId, debitCents: row.netCents },
                { accountId: fallbackAccountId, creditCents: row.netCents },
              ],
        });
      }

      await db.update(documentLines).set({
        accountId: newAccountId,
        costCenterId: newCostCenterId ?? null,
      }).where(eq(documentLines.id, lineId));

      await logAudit({ action: "reclassify_line", module: "accountant", recordId: row.docId, recordLabel: row.docNumber, detail: `${fmtKES(row.netCents)} moved to ${target.code} · ${target.name}` });
      revalidatePath("/accountant/uncategorized");
      revalidatePath("/accountant");
      return { success: true };
    });
  } catch (err: any) {
    return { error: err?.message || "Failed to reclassify" };
  }
}
