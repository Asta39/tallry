import type { Access } from "@/lib/access";

/** The owner/admin always can; any other role needs the "manage_leave_requests"
 *  module toggle explicitly granted — distinct from the broader "leave_requests"
 *  permission, which just gates submitting/seeing this screen for your own
 *  requests. Without this toggle, a role's staff only ever see their own.
 *  Not colocated with leave-requests.ts (a "use server" file) — Next.js
 *  Server Action modules may only export async functions. */
export function canReviewLeaveRequests(access: Pick<Access, "isOwner" | "role" | "perms"> | null): boolean {
  if (!access) return false;
  return access.isOwner || access.role === "admin" || access.perms.has("manage_leave_requests");
}
