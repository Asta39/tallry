"use server";

import { db, teamAnnouncements } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { nowISO } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { notifyOrg } from "@/lib/notifications";

export async function listAnnouncements() {
  return withOrg(async () => {
    await requirePerm("announcements");
    return db
      .select()
      .from(teamAnnouncements)
      .where(eq(teamAnnouncements.orgId, currentOrgId()))
      .orderBy(desc(teamAnnouncements.pinned), desc(teamAnnouncements.createdAt));
  });
}

export async function createAnnouncementAction(data: { title: string; body: string; pinned?: boolean }) {
  return withOrg(async () => {
    await requirePerm("announcements");
    const access = await getAccess();
    if (!access?.isOwner && access?.role !== "admin") {
      throw new Error("Only admins can post announcements");
    }
    if (!data.title.trim()) throw new Error("Give the announcement a title");
    if (!data.body.trim()) throw new Error("Write something in the announcement");

    const orgId = currentOrgId();
    await db.insert(teamAnnouncements).values({
      orgId,
      title: data.title.trim(),
      body: data.body.trim(),
      pinned: data.pinned ?? false,
      createdByName: access?.memberName || "Owner",
      createdAt: nowISO(),
    });

    await notifyOrg(orgId, "all", `📣 ${data.title.trim()}`, data.body.trim().slice(0, 140), "/announcements");
    revalidatePath("/announcements");
    return { success: true };
  });
}

export async function deleteAnnouncementAction(id: number) {
  return withOrg(async () => {
    await requirePerm("announcements");
    const access = await getAccess();
    if (!access?.isOwner && access?.role !== "admin") {
      throw new Error("Only admins can delete announcements");
    }
    const orgId = currentOrgId();
    await db.delete(teamAnnouncements).where(and(eq(teamAnnouncements.orgId, orgId), eq(teamAnnouncements.id, id)));
    revalidatePath("/announcements");
    return { success: true };
  });
}

export async function togglePinAnnouncementAction(id: number, pinned: boolean) {
  return withOrg(async () => {
    await requirePerm("announcements");
    const access = await getAccess();
    if (!access?.isOwner && access?.role !== "admin") {
      throw new Error("Only admins can pin announcements");
    }
    const orgId = currentOrgId();
    await db.update(teamAnnouncements).set({ pinned }).where(and(eq(teamAnnouncements.orgId, orgId), eq(teamAnnouncements.id, id)));
    revalidatePath("/announcements");
    return { success: true };
  });
}
