import { cache } from "react";
import { db, platformSettings } from "@/db";
import { eq } from "drizzle-orm";
import { nowISO } from "@/lib/money";

export const PLATFORM_SETTINGS_ID = 1;

/** Migration seeds row id 1 with today's real values, so this only fires if
 *  that seed somehow never ran (e.g. a fresh environment). */
export async function ensurePlatformSettingsRow() {
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, PLATFORM_SETTINGS_ID)).limit(1);
  if (row) return row;
  const [created] = await db.insert(platformSettings).values({ id: PLATFORM_SETTINGS_ID, updatedAt: nowISO() }).returning();
  return created;
}

/** Cached per-request — every call site in one render gets the same values.
 *  Plain server-only module (no "use server") — the mutation that pairs
 *  with this lives in admin/actions.ts instead, since a client component
 *  importing a server action needs "use server" on the whole file, and
 *  this file's cache()-wrapped read isn't a valid action export. */
export const getPlatformSettings = cache(async () => ensurePlatformSettingsRow());
