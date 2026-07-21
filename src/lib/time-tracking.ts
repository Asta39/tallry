"use server";

import { db, timeShifts } from "@/db";
import { eq, and, isNull, desc, gte, lte } from "drizzle-orm";
import { withOrg, currentOrgId, getOrg } from "@/lib/org";
import { getAccess } from "@/lib/access";
import { nowISO } from "@/lib/money";
import { revalidatePath } from "next/cache";

function personKey(access: Awaited<ReturnType<typeof getAccess>>) {
  return { memberId: access?.memberId ?? null, personName: access?.memberName || "Owner" };
}

/** The signed-in user's currently-open shift, if any. Null if time tracking is off. */
export async function getActiveShift() {
  return withOrg(async () => {
    const o = await getOrg();
    if (!o.timeTrackingEnabled) return null;
    const access = await getAccess();
    const { memberId } = personKey(access);
    const orgId = currentOrgId();
    const [row] = await db.select().from(timeShifts)
      .where(and(
        eq(timeShifts.orgId, orgId),
        memberId === null ? isNull(timeShifts.memberId) : eq(timeShifts.memberId, memberId),
        isNull(timeShifts.clockOutAt),
      ))
      .orderBy(desc(timeShifts.id)).limit(1);
    return row || null;
  });
}

export async function clockInAction() {
  return withOrg(async () => {
    const o = await getOrg();
    if (!o.timeTrackingEnabled) throw new Error("Time tracking isn't enabled for this organization");
    const access = await getAccess();
    const { memberId, personName } = personKey(access);
    const orgId = currentOrgId();

    const [existing] = await db.select().from(timeShifts)
      .where(and(
        eq(timeShifts.orgId, orgId),
        memberId === null ? isNull(timeShifts.memberId) : eq(timeShifts.memberId, memberId),
        isNull(timeShifts.clockOutAt),
      )).limit(1);
    if (existing) return { shift: existing };

    const [row] = await db.insert(timeShifts).values({
      orgId,
      memberId,
      personName,
      clockInAt: nowISO(),
      createdAt: nowISO(),
    }).returning();

    revalidatePath("/");
    return { shift: row };
  });
}

export async function clockOutAction(shiftId: number) {
  return withOrg(async () => {
    const access = await getAccess();
    const { memberId } = personKey(access);
    const orgId = currentOrgId();

    const [shift] = await db.select().from(timeShifts)
      .where(and(eq(timeShifts.id, shiftId), eq(timeShifts.orgId, orgId))).limit(1);
    if (!shift) throw new Error("Shift not found");
    if (shift.memberId !== memberId) throw new Error("Not your shift");
    if (shift.clockOutAt) return { shift };

    const clockOutAt = nowISO();
    const durationSeconds = Math.max(0, Math.round((new Date(clockOutAt).getTime() - new Date(shift.clockInAt).getTime()) / 1000));

    const [updated] = await db.update(timeShifts)
      .set({ clockOutAt, durationSeconds })
      .where(eq(timeShifts.id, shiftId))
      .returning();

    revalidatePath("/");
    return { shift: updated };
  });
}

/** My recent shifts, most recent first. */
export async function myRecentShifts(limit = 20) {
  return withOrg(async () => {
    const access = await getAccess();
    const { memberId } = personKey(access);
    const orgId = currentOrgId();
    return db.select().from(timeShifts)
      .where(and(
        eq(timeShifts.orgId, orgId),
        memberId === null ? isNull(timeShifts.memberId) : eq(timeShifts.memberId, memberId),
      ))
      .orderBy(desc(timeShifts.id)).limit(limit);
  });
}

/** Total worked hours per person for a date range — reference data for running payroll. */
export async function teamHoursSummary(fromDate: string, toDate: string) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const rows = await db.select().from(timeShifts)
      .where(and(
        eq(timeShifts.orgId, orgId),
        gte(timeShifts.clockInAt, fromDate),
        lte(timeShifts.clockInAt, toDate + "T23:59:59.999Z"),
      ))
      .orderBy(desc(timeShifts.clockInAt));

    const byPerson = new Map<string, { personName: string; totalSeconds: number; shifts: number; openShifts: number }>();
    for (const r of rows) {
      const key = r.memberId === null ? "owner" : String(r.memberId);
      const agg = byPerson.get(key) || { personName: r.personName, totalSeconds: 0, shifts: 0, openShifts: 0 };
      agg.shifts += 1;
      if (r.durationSeconds) agg.totalSeconds += r.durationSeconds;
      if (!r.clockOutAt) agg.openShifts += 1;
      byPerson.set(key, agg);
    }
    return { rows, summary: Array.from(byPerson.values()).sort((a, b) => b.totalSeconds - a.totalSeconds) };
  });
}
