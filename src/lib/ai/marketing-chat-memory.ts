import { db, marketingChatTopics } from "@/db";
import { and, desc, gt, ne, sql } from "drizzle-orm";

/**
 * Aggregate-only "learning" for the public marketing-site AI assistant.
 *
 * This is intentionally NOT per-visitor memory — there is no cookie,
 * session id, or IP tied to any row, and no raw question text is ever
 * stored (only a coarse topic tag from a fixed list). That's a deliberate
 * privacy boundary: an anonymous public chat widget has no business
 * building a profile of who asked what. What it *can* safely do is notice,
 * in aggregate across everyone, which topics come up most — real counts,
 * never fabricated — and let that lightly inform tone/emphasis over time.
 *
 * This module is the ONLY part of the marketing-assistant feature that
 * imports `@/db`, and it only ever touches this one purpose-built table —
 * never a tenant table. marketing-assistant.ts and
 * marketing-assistant-rules.ts stay completely free of any db import, so
 * their "structurally can't reach real data" guarantee remains literally
 * true; this file just separately remembers what topics are popular.
 */

const TOPIC_KEYWORDS: Array<{ topic: string; pattern: RegExp }> = [
  { topic: "pricing", pattern: /\b(price|pricing|cost|fee|payment|billing|kes|ksh|shilling)\b/i },
  { topic: "invoicing", pattern: /\b(invoic\w*|quotes?|quoting|estimates?)\b/i },
  { topic: "payroll", pattern: /\b(payroll|paye|nssf|shif|salary|salaries|payslip)\b/i },
  { topic: "crm", pattern: /\b(crm|leads?|deals?|pipeline|customers?)\b/i },
  { topic: "m-pesa & banking", pattern: /\b(m-?pesa|mpesa|bank|reconcil)/i },
  { topic: "inventory", pattern: /\b(inventory|stock|warehouse)\b/i },
  { topic: "reporting", pattern: /\b(report|reports|analytics|dashboard)\b/i },
  { topic: "security & privacy", pattern: /\b(secure|security|privacy|encrypt|data protection)\b/i },
  { topic: "compliance", pattern: /\b(kra|vat|etims|compliance|tax)\b/i },
  { topic: "onboarding", pattern: /\b(onboard|setup|set up|get started|sign ?up|trial)\b/i },
  { topic: "support", pattern: /\b(support|contact|phone|email|help)\b/i },
  { topic: "integrations", pattern: /\b(integrat|api|connect)\b/i },
];

/** Best-effort topic guess from a fixed taxonomy — never stores free text. */
export function classifyTopic(message: string): string {
  for (const { topic, pattern } of TOPIC_KEYWORDS) {
    if (pattern.test(message)) return topic;
  }
  return "general";
}

/** Fire-and-forget: logs one topic tag. Never throws — a logging failure
 *  must never affect the visitor's actual answer. */
export async function logTopic(topic: string): Promise<void> {
  try {
    await db.insert(marketingChatTopics).values({ topic, createdAt: new Date().toISOString() });
  } catch {
    // Best-effort only — swallow. This table is a nice-to-have, not load-bearing.
  }
}

/**
 * Returns a short, honest summary of what visitors have actually asked
 * about most in the last 30 days (or null if there's not enough data yet
 * to say anything meaningful) — real aggregate counts, safe to fold into
 * the system prompt as-is since it's never invented.
 */
export async function getTopTopicsHint(): Promise<string | null> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await db
      .select({ topic: marketingChatTopics.topic, n: sql<number>`count(*)::int` })
      .from(marketingChatTopics)
      .where(and(gt(marketingChatTopics.createdAt, since), ne(marketingChatTopics.topic, "general")))
      .groupBy(marketingChatTopics.topic)
      .orderBy(desc(sql`count(*)`))
      .limit(4);

    const top = rows.filter((r) => r.n >= 3);
    if (top.length === 0) return null;
    return top.map((r) => r.topic).join(", ");
  } catch {
    return null;
  }
}
