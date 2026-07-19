import { db, adminAuditLog } from "@/db";

/** Fire-and-forget audit record for a super admin action. Never throws — auditing must not break the action. */
export async function logAdminAction(params: {
  actorEmail: string;
  action: string;
  targetType?: "org" | "super_admin";
  targetId?: string | number;
  detail?: string;
}) {
  try {
    await db.insert(adminAuditLog).values({
      actorEmail: params.actorEmail,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId !== undefined ? String(params.targetId) : undefined,
      detail: params.detail,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("admin audit log failed:", e);
  }
}
