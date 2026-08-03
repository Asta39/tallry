"use server";

import { db, leaveRequests } from "@/db";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { nowISO } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { notifyOrg, notifyMembers } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

const LEAVE_TYPES = ["annual", "sick", "unpaid", "maternity", "paternity", "compassionate", "other"] as const;
type LeaveType = (typeof LEAVE_TYPES)[number];

function normalizeLeaveType(v: string | null | undefined): LeaveType {
  return (LEAVE_TYPES as readonly string[]).includes(v ?? "") ? (v as LeaveType) : "other";
}

/** Only the org owner or an admin-role member may review requests — mirrors
 *  the "admins approve" requirement, distinct from the broader leave_requests
 *  module permission that just gates who can submit/see this screen at all. */
function assertCanReview(access: NonNullable<Awaited<ReturnType<typeof getAccess>>>) {
  if (!(access.isOwner || access.role === "admin")) {
    throw new Error("Only an admin can review leave requests");
  }
}

export async function myLeaveRequests() {
  return withOrg(async () => {
    const access = await getAccess();
    const orgId = currentOrgId();
    const rows = access?.memberId
      ? await db.select().from(leaveRequests).where(and(eq(leaveRequests.orgId, orgId), eq(leaveRequests.memberId, access.memberId))).orderBy(desc(leaveRequests.createdAt))
      : await db.select().from(leaveRequests).where(and(eq(leaveRequests.orgId, orgId), isNull(leaveRequests.memberId))).orderBy(desc(leaveRequests.createdAt));
    return rows;
  });
}

export async function pendingLeaveRequests() {
  return withOrg(() =>
    db.select().from(leaveRequests).where(and(eq(leaveRequests.orgId, currentOrgId()), eq(leaveRequests.status, "pending"))).orderBy(desc(leaveRequests.createdAt))
  );
}

export async function reviewedLeaveRequests() {
  return withOrg(() =>
    db.select().from(leaveRequests).where(and(eq(leaveRequests.orgId, currentOrgId()), or(eq(leaveRequests.status, "approved"), eq(leaveRequests.status, "rejected")))).orderBy(desc(leaveRequests.createdAt)).limit(50)
  );
}

export async function submitLeaveRequestAction(data: {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  return withOrg(async () => {
    await requirePerm("leave_requests");
    const access = await getAccess();
    const orgId = currentOrgId();

    if (!data.reason.trim()) throw new Error("Add a short reason");
    if (!data.startDate || !data.endDate) throw new Error("Pick a start and end date");
    if (data.endDate < data.startDate) throw new Error("End date can't be before the start date");

    const requestedByName = access?.memberName || "Owner";
    const leaveType = normalizeLeaveType(data.leaveType);

    const [row] = await db.insert(leaveRequests).values({
      orgId,
      memberId: access?.memberId ?? null,
      requestedByName,
      leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason.trim(),
      status: "pending",
      createdAt: nowISO(),
    }).returning();

    await logAudit({
      action: "submit",
      module: "leave_requests",
      recordId: row.id,
      recordLabel: `${requestedByName} · ${leaveType}`,
      detail: `${data.startDate} to ${data.endDate}`,
    });

    await notifyOrg(orgId, ["admin"], "New leave request", `${requestedByName} requested ${leaveType} leave (${data.startDate} to ${data.endDate})`, "/leave-requests");
    revalidatePath("/leave-requests");
    return { success: true };
  });
}

export async function approveLeaveRequestAction(id: number, note?: string) {
  return withOrg(async () => {
    const access = await getAccess();
    if (!access) throw new Error("Not authorized");
    assertCanReview(access);
    const orgId = currentOrgId();

    const [row] = await db
      .update(leaveRequests)
      .set({
        status: "approved",
        reviewedByName: access.memberName || "Owner",
        adminNote: note?.trim() || null,
        reviewedAt: nowISO(),
      })
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.orgId, orgId), eq(leaveRequests.status, "pending")))
      .returning();
    if (!row) throw new Error("Request already reviewed");

    await logAudit({ action: "approve", module: "leave_requests", recordId: id, recordLabel: `${row.requestedByName} · ${row.leaveType}`, detail: note?.trim() || undefined });

    if (row.memberId) {
      await notifyMembers(orgId, [row.memberId], "Leave request approved", `Your ${row.leaveType} leave (${row.startDate} to ${row.endDate}) was approved.`, "/leave-requests");
    }

    revalidatePath("/leave-requests");
    return { success: true };
  });
}

export async function rejectLeaveRequestAction(id: number, note: string) {
  return withOrg(async () => {
    const access = await getAccess();
    if (!access) throw new Error("Not authorized");
    assertCanReview(access);
    const orgId = currentOrgId();

    const [row] = await db
      .update(leaveRequests)
      .set({
        status: "rejected",
        reviewedByName: access.memberName || "Owner",
        adminNote: note?.trim() || null,
        reviewedAt: nowISO(),
      })
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.orgId, orgId), eq(leaveRequests.status, "pending")))
      .returning();
    if (!row) throw new Error("Request already reviewed");

    await logAudit({ action: "reject", module: "leave_requests", recordId: id, recordLabel: `${row.requestedByName} · ${row.leaveType}`, detail: note?.trim() || undefined });

    if (row.memberId) {
      await notifyMembers(orgId, [row.memberId], "Leave request rejected", `Your ${row.leaveType} leave (${row.startDate} to ${row.endDate}) was rejected.${note ? ` Note: ${note.trim()}` : ""}`, "/leave-requests");
    }

    revalidatePath("/leave-requests");
    return { success: true };
  });
}
