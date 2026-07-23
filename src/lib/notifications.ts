import { db, notifications, members } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { nowISO } from "./money";

/**
 * Creates an in-app notification for the organization owner and any staff members
 * matching the specified roles.
 * 
 * @param orgId The organization ID
 * @param roles Target roles (e.g. ['admin', 'sales']). Use 'all' to notify all active staff.
 * @param title Short title for the notification
 * @param body Detailed body text
 * @param link Optional relative link when the notification is clicked
 */
export async function notifyOrg(
  orgId: number,
  roles: string[] | "all",
  title: string,
  body: string,
  link?: string
) {
  // Always notify the owner (memberId = null)
  const inserts = [
    {
      orgId,
      memberId: null,
      title,
      body,
      link,
      createdAt: nowISO(),
    },
  ];

  // Find target staff members
  const conditions = [
    eq(members.orgId, orgId),
    eq(members.active, true)
  ];
  if (roles !== "all") {
    conditions.push(inArray(members.role, roles));
  }

  const targets = await db
    .select({ id: members.id })
    .from(members)
    .where(and(...conditions));

  for (const t of targets) {
    inserts.push({
      orgId,
      memberId: t.id as any,
      title,
      body,
      link,
      createdAt: nowISO(),
    });
  }

  await db.insert(notifications).values(inserts);
}

/** Notify exact staff members (not a whole role) — used when a document/template is assigned to specific people. */
export async function notifyMembers(orgId: number, memberIds: number[], title: string, body: string, link?: string) {
  if (memberIds.length === 0) return;
  await db.insert(notifications).values(
    memberIds.map((memberId) => ({
      orgId,
      memberId,
      title,
      body,
      link,
      createdAt: nowISO(),
    }))
  );
}
