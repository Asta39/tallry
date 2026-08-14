"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, fixedAssets, journalEntries, journalLines, bankAccounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { runMonthlyDepreciation } from "@/lib/depreciation";
import { postEntry, mirrorBankTxn, type PostLine } from "@/lib/posting";
import { ensureAccount } from "@/lib/phase-a-actions";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function runDepreciationAction(dateStr: string) {
  try {
    await requirePerm("fixed_assets");
    const o = await getOrg();
    const results = await runMonthlyDepreciation(o.id, dateStr);
    
    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error("Depreciation errors:", errors);
      return { error: `Failed to depreciate ${errors.length} assets. See console.` };
    }

    revalidatePath("/accounting/assets");
    return { count: results.length };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function createAssetAction(formData: FormData) {
  await requirePerm("fixed_assets");
  const o = await getOrg();

  const name = formData.get("name") as string;
  const assetAccountId = parseInt(formData.get("assetAccountId") as string, 10);
  const depreciationAccountId = parseInt(formData.get("depreciationAccountId") as string, 10);
  const expenseAccountId = parseInt(formData.get("expenseAccountId") as string, 10);
  const purchaseDate = formData.get("purchaseDate") as string;
  const purchaseCostCents = Math.round(parseFloat(formData.get("purchaseCost") as string) * 100);
  const salvageValueCents = Math.round(parseFloat(formData.get("salvageValue") as string || "0") * 100);
  const usefulLifeMonths = parseInt(formData.get("usefulLifeMonths") as string, 10);
  const paidFromBankAccountId = formData.get("paidFromBankAccountId") ? parseInt(formData.get("paidFromBankAccountId") as string, 10) : null;

  if (!name || !assetAccountId || !depreciationAccountId || !expenseAccountId || !purchaseDate || purchaseCostCents <= 0 || usefulLifeMonths <= 0) {
    throw new Error("Missing or invalid required fields");
  }

  // Records the purchase itself — DR the fixed asset account, CR the bank/
  // M-Pesa account it was paid from — so registering an asset actually
  // moves money in the books instead of just seeding depreciation tracking
  // with no corresponding cash entry anywhere.
  let purchaseJournalEntryId: number | null = null;
  let bank: { id: number; accountId: number } | undefined;
  if (paidFromBankAccountId) {
    const [b] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.id, paidFromBankAccountId))).limit(1);
    if (!b) throw new Error("Bank/M-Pesa account not found");
    bank = b;
    purchaseJournalEntryId = await postEntry({
      date: purchaseDate,
      memo: `Purchase of fixed asset: ${name}`,
      sourceType: "asset_purchase",
      lines: [
        { accountId: assetAccountId, debitCents: purchaseCostCents },
        { accountId: bank.accountId, creditCents: purchaseCostCents },
      ],
    });
  }

  const [created] = await db.insert(fixedAssets).values({
    orgId: o.id,
    name,
    assetAccountId,
    depreciationAccountId,
    expenseAccountId,
    purchaseDate,
    purchaseCostCents,
    salvageValueCents,
    usefulLifeMonths,
    depreciationMethod: "straight_line",
    paidFromBankAccountId,
    purchaseJournalEntryId,
    createdAt: new Date().toISOString(),
  }).returning();

  if (bank && purchaseJournalEntryId) {
    await mirrorBankTxn({
      bankAccountId: bank.id,
      date: purchaseDate,
      description: `Asset purchase: ${name}`,
      amountCents: -purchaseCostCents,
      journalEntryId: purchaseJournalEntryId,
      externalRef: `assetpurchase:${created.id}`,
    });
  }

  revalidatePath("/accounting/assets");
  redirect("/accounting/assets");
}

/**
 * Dispose of a fixed asset — sale, scrap, or write-off. Previously there was
 * no way to do this at all: an asset just sat in the register forever,
 * still picked up by runMonthlyDepreciation's `status = "active"` filter,
 * permanently overstating depreciation expense past the point it was
 * actually owned. Posts the standard disposal entry:
 *   DR Accumulated Depreciation (to date) · CR Asset (original cost)
 *   DR proceeds received (if any) · plug DR/CR Gain-or-Loss on Disposal
 * Accumulated depreciation is derived from the depreciation entries already
 * posted for this asset (sourceType "depreciation", sourceId = asset id) —
 * nothing is tracked as a separate running total that could drift.
 */
export async function disposeAssetAction(
  assetId: number,
  disposalDate: string,
  proceedsCents: number,
  bankAccountId?: number
): Promise<{ success?: true; error?: string }> {
  try {
    await requirePerm("fixed_assets");
    const o = await getOrg();

    if (proceedsCents < 0) throw new Error("Proceeds can't be negative");

    // Atomic claim — two concurrent dispose attempts on the same asset must
    // not both post the removal entry.
    const [asset] = await db
      .update(fixedAssets)
      .set({ status: "disposing" })
      .where(and(eq(fixedAssets.orgId, o.id), eq(fixedAssets.id, assetId), eq(fixedAssets.status, "active")))
      .returning();
    if (!asset) throw new Error("Asset not found or already disposed");

    try {
      const depRows = await db
        .select({ credit: journalLines.creditCents })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
        .where(and(
          eq(journalEntries.orgId, o.id),
          eq(journalEntries.sourceType, "depreciation"),
          eq(journalEntries.sourceId, assetId),
          eq(journalLines.accountId, asset.depreciationAccountId),
        ));
      const accumulatedDepCents = depRows.reduce((s, r) => s + r.credit, 0);
      const netBookValueCents = asset.purchaseCostCents - accumulatedDepCents;
      const gainLossCents = proceedsCents - netBookValueCents; // positive = gain, negative = loss

      let bank: { id: number; accountId: number } | undefined;
      if (proceedsCents > 0) {
        if (!bankAccountId) throw new Error("Select which account received the disposal proceeds");
        const [b] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.id, bankAccountId))).limit(1);
        if (!b) throw new Error("Bank account not found");
        bank = b;
      }

      const gainLossAccountId = await ensureAccount("7200", "Gain/Loss on Asset Disposal", "income", "other_income");

      const lines: PostLine[] = [
        { accountId: asset.depreciationAccountId, debitCents: accumulatedDepCents },
        { accountId: asset.assetAccountId, creditCents: asset.purchaseCostCents },
      ];
      if (bank && proceedsCents > 0) lines.push({ accountId: bank.accountId, debitCents: proceedsCents });
      if (gainLossCents > 0) lines.push({ accountId: gainLossAccountId, creditCents: gainLossCents });
      else if (gainLossCents < 0) lines.push({ accountId: gainLossAccountId, debitCents: -gainLossCents });

      const entryId = await postEntry({
        date: disposalDate,
        memo: `Disposal of ${asset.name}`,
        sourceType: "asset_disposal",
        sourceId: asset.id,
        lines,
      });

      if (bank && proceedsCents > 0) {
        await mirrorBankTxn({
          bankAccountId: bank.id,
          date: disposalDate,
          description: `Disposal proceeds: ${asset.name}`,
          amountCents: proceedsCents,
          journalEntryId: entryId,
          externalRef: `assetdisp:${asset.id}`,
        });
      }

      await db.update(fixedAssets).set({ status: "disposed" }).where(and(eq(fixedAssets.orgId, o.id), eq(fixedAssets.id, assetId)));
      await logAudit({
        action: "dispose",
        module: "items",
        recordId: assetId,
        recordLabel: asset.name,
        detail: `Net book value ${(netBookValueCents / 100).toFixed(2)}, proceeds ${(proceedsCents / 100).toFixed(2)}, ${gainLossCents >= 0 ? "gain" : "loss"} ${(Math.abs(gainLossCents) / 100).toFixed(2)}`,
      });

      revalidatePath("/accounting/assets");
      return { success: true };
    } catch (e) {
      await db.update(fixedAssets).set({ status: "active" }).where(and(eq(fixedAssets.orgId, o.id), eq(fixedAssets.id, assetId), eq(fixedAssets.status, "disposing")));
      throw e;
    }
  } catch (err: any) {
    return { error: err?.message || "Failed to dispose of asset" };
  }
}
