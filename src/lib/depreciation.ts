import { db, fixedAssets, accounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { postJournal } from "./posting";

export interface DepreciationResult {
  assetId: number;
  assetName: string;
  monthlyExpenseCents: number;
  journalEntryId?: number;
  error?: string;
}

/**
 * Runs straight-line depreciation for all active assets in an org for a given month.
 * @param orgId The organization ID
 * @param date YYYY-MM-DD representing the end of the month to run depreciation for
 */
export async function runMonthlyDepreciation(orgId: number, date: string): Promise<DepreciationResult[]> {
  const assets = await db.select().from(fixedAssets).where(
    and(
      eq(fixedAssets.orgId, orgId),
      eq(fixedAssets.status, "active")
    )
  );

  const results: DepreciationResult[] = [];

  for (const asset of assets) {
    // Only depreciate if purchase date is on or before the run date
    if (asset.purchaseDate > date) continue;

    // Straight line: (Cost - Salvage) / Useful Life
    const depreciableBase = asset.purchaseCostCents - asset.salvageValueCents;
    if (depreciableBase <= 0 || asset.usefulLifeMonths <= 0) continue;

    const monthlyExpense = Math.round(depreciableBase / asset.usefulLifeMonths);

    try {
      const entryId = await postJournal(orgId, {
        date,
        memo: `Depreciation for ${asset.name} - ${date.slice(0, 7)}`,
        sourceType: "depreciation",
        sourceId: asset.id,
        lines: [
          { accountId: asset.expenseAccountId, debitCents: monthlyExpense, creditCents: 0 },
          { accountId: asset.depreciationAccountId, debitCents: 0, creditCents: monthlyExpense },
        ],
      });

      results.push({
        assetId: asset.id,
        assetName: asset.name,
        monthlyExpenseCents: monthlyExpense,
        journalEntryId: entryId,
      });
    } catch (e: any) {
      results.push({
        assetId: asset.id,
        assetName: asset.name,
        monthlyExpenseCents: monthlyExpense,
        error: e.message,
      });
    }
  }

  return results;
}
