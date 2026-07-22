"use server";

import { db, costCenters } from "@/db";
import { eq, and } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { nowISO } from "@/lib/money";
import { revalidatePath } from "next/cache";

export async function listCostCenters(activeOnly = false) {
  return withOrg(() => {
    const orgId = currentOrgId();
    return db.select().from(costCenters).where(
      activeOnly ? and(eq(costCenters.orgId, orgId), eq(costCenters.active, true)) : eq(costCenters.orgId, orgId)
    ).orderBy(costCenters.name);
  });
}

export async function createCostCenterAction(data: { name: string; code?: string }) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const name = data.name.trim();
    if (!name) throw new Error("Name is required");
    await db.insert(costCenters).values({
      orgId: currentOrgId(),
      name,
      code: data.code?.trim() || null,
      createdAt: nowISO(),
    });
    revalidatePath("/accountant/cost-centers");
    return { success: true };
  });
}

export async function updateCostCenterAction(id: number, data: { name: string; code?: string }) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();
    const name = data.name.trim();
    if (!name) throw new Error("Name is required");
    const [existing] = await db.select().from(costCenters).where(and(eq(costCenters.orgId, orgId), eq(costCenters.id, id))).limit(1);
    if (!existing) throw new Error("Cost center not found");
    await db.update(costCenters).set({ name, code: data.code?.trim() || null }).where(eq(costCenters.id, id));
    revalidatePath("/accountant/cost-centers");
    return { success: true };
  });
}

export async function toggleCostCenterActiveAction(id: number, active: boolean) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();
    const [existing] = await db.select().from(costCenters).where(and(eq(costCenters.orgId, orgId), eq(costCenters.id, id))).limit(1);
    if (!existing) throw new Error("Cost center not found");
    await db.update(costCenters).set({ active }).where(eq(costCenters.id, id));
    revalidatePath("/accountant/cost-centers");
    return { success: true };
  });
}
