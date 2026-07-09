"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, fixedAssets } from "@/db";
import { runMonthlyDepreciation } from "@/lib/depreciation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function runDepreciationAction(dateStr: string) {
  try {
    await requirePerm("accountant");
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
  await requirePerm("accountant");
  const o = await getOrg();

  const name = formData.get("name") as string;
  const assetAccountId = parseInt(formData.get("assetAccountId") as string, 10);
  const depreciationAccountId = parseInt(formData.get("depreciationAccountId") as string, 10);
  const expenseAccountId = parseInt(formData.get("expenseAccountId") as string, 10);
  const purchaseDate = formData.get("purchaseDate") as string;
  const purchaseCostCents = Math.round(parseFloat(formData.get("purchaseCost") as string) * 100);
  const salvageValueCents = Math.round(parseFloat(formData.get("salvageValue") as string || "0") * 100);
  const usefulLifeMonths = parseInt(formData.get("usefulLifeMonths") as string, 10);

  if (!name || !assetAccountId || !depreciationAccountId || !expenseAccountId || !purchaseDate || purchaseCostCents <= 0 || usefulLifeMonths <= 0) {
    throw new Error("Missing or invalid required fields");
  }

  await db.insert(fixedAssets).values({
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
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/accounting/assets");
  redirect("/accounting/assets");
}
