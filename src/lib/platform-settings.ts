import { cache } from "react";
import { db, platformSettings } from "@/db";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/super-admin";
import { nowISO } from "@/lib/money";
import { revalidatePath } from "next/cache";

const SINGLETON_ID = 1;

/** Migration seeds row id 1 with today's real values, so this only fires if
 *  that seed somehow never ran (e.g. a fresh environment). */
async function ensureRow() {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, SINGLETON_ID)).limit(1);
  if (row) return row;
  const [created] = await db.insert(platformSettings).values({ id: SINGLETON_ID, updatedAt: nowISO() }).returning();
  return created;
}

/** Cached per-request — every call site in one render gets the same values. */
export const getPlatformSettings = cache(async () => ensureRow());

export async function updatePlatformSettingsAction(data: {
  trialDays: number;
  perStaffMonthlyFeeCents: number;
  platformOrgId: number | null;
}) {
  const user = await requireSuperAdmin();
  if (!Number.isInteger(data.trialDays) || data.trialDays < 1) throw new Error("Trial days must be a positive whole number");
  if (!Number.isInteger(data.perStaffMonthlyFeeCents) || data.perStaffMonthlyFeeCents < 0) throw new Error("Per-seat fee must be a non-negative amount");

  await ensureRow();
  await db.update(platformSettings).set({
    trialDays: data.trialDays,
    perStaffMonthlyFeeCents: data.perStaffMonthlyFeeCents,
    platformOrgId: data.platformOrgId,
    updatedAt: nowISO(),
    updatedByEmail: user.email ?? null,
  }).where(eq(platformSettings.id, SINGLETON_ID));

  revalidatePath("/admin/settings");
  return { success: true };
}
