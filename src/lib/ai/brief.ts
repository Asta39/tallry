import { db, documents, documentAssignments } from "@/db";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { withOrg } from "@/lib/org";
import type { Access } from "@/lib/access";
import { todayISO } from "@/lib/money";

export interface DailyBrief {
  overdueInvoices: number;
  overdueBills: number;
  draftsUntouched: number; // draft invoices/quotes older than 3 days
  pendingApprovalBills: number;
  count: number; // total items needing attention — drives the pill badge
}

const STALE_DRAFT_DAYS = 3;

/**
 * Plain SQL rollup, not an LLM call — the model only phrases this when asked,
 * it never invents the numbers. Scoped to this member's assigned documents
 * unless they're owner/admin, in which case it's org-wide.
 */
export async function getDailyBrief(access: Access): Promise<DailyBrief> {
  return withOrg(async () => {
    const today = todayISO();
    const staleBefore = new Date(Date.now() - STALE_DRAFT_DAYS * 86400_000).toISOString().slice(0, 10);
    const scopedToMember = !access.isOwner && access.role !== "admin" && access.memberId;

    const assignedDocIds = scopedToMember
      ? (
          await db
            .select({ documentId: documentAssignments.documentId })
            .from(documentAssignments)
            .where(and(eq(documentAssignments.orgId, access.orgId), eq(documentAssignments.memberId, access.memberId!)))
        ).map((r) => r.documentId)
      : null;

    const scopeCond = assignedDocIds ? inArray(documents.id, assignedDocIds.length ? assignedDocIds : [-1]) : undefined;

    const countWhere = async (conds: any[]) => {
      const where = scopeCond ? and(...conds, scopeCond) : and(...conds);
      const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(documents).where(where);
      return row?.n ?? 0;
    };

    const [overdueInvoices, overdueBills, draftsUntouched, pendingApprovalBills] = await Promise.all([
      countWhere([eq(documents.orgId, access.orgId), eq(documents.type, "invoice"), inArray(documents.status, ["open", "partial"]), lt(documents.dueDate, today)]),
      countWhere([eq(documents.orgId, access.orgId), eq(documents.type, "bill"), inArray(documents.status, ["open", "partial"]), lt(documents.dueDate, today)]),
      countWhere([eq(documents.orgId, access.orgId), inArray(documents.type, ["invoice", "quote"]), eq(documents.status, "draft"), lt(documents.date, staleBefore)]),
      countWhere([eq(documents.orgId, access.orgId), eq(documents.type, "bill"), eq(documents.status, "pending_approval")]),
    ]);

    return {
      overdueInvoices,
      overdueBills,
      draftsUntouched,
      pendingApprovalBills,
      count: overdueInvoices + overdueBills + draftsUntouched + pendingApprovalBills,
    };
  });
}
