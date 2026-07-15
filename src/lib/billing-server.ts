import { db, subscriptions, documents } from "@/db";
import { eq, and, sql, gte, lt } from "drizzle-orm";
import { PLANS, PlanKey, Entitlements } from "./billing";

export async function getEntitlements(orgId: number): Promise<Entitlements> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  if (!sub) {
    // Fallback if no sub exists, though we should create it on org creation
    return {
      plan: "free",
      isReadOnly: false,
      limits: PLANS.free,
      paidUntil: "9999-12-31",
    };
  }

  const today = new Date().toISOString().split("T")[0];
  const isReadOnly = sub.paidUntil < today;
  const planKey = (PLANS[sub.plan as PlanKey] ? sub.plan : "free") as PlanKey;

  return {
    plan: planKey,
    isReadOnly,
    limits: PLANS[planKey],
    paidUntil: sub.paidUntil,
  };
}

export async function getInvoiceUsage(orgId: number): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.type, 'invoice'),
        gte(documents.createdAt, startOfMonth)
      )
    );
    
  return Number(result.count || 0);
}
