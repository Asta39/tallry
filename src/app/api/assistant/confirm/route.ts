import { NextRequest, NextResponse } from "next/server";
import { db, aiMessages } from "@/db";
import { getAccess } from "@/lib/access";
import { nairobiDateISO } from "@/lib/timezone";
import { executeConfirmedAction } from "@/lib/ai/llm";
import { findWriteTool } from "@/lib/ai/tools";
import { logAudit, type AuditModule } from "@/lib/audit";

export const dynamic = "force-dynamic";

// AI write tool -> audit module, mirrors the module each underlying actions.ts
// wrapper already logs under, so this shows up right next to a human doing
// the same thing in /settings/audit-logs.
const TOOL_MODULE: Record<string, AuditModule> = {
  draftInvoice: "invoices",
  draftQuote: "quotes",
  draftBill: "bills",
  draftExpense: "expenses",
  recordPayment: "payments",
  voidDocument: "invoices",
  adjustStock: "items",
  createContact: "contacts",
};

export async function POST(req: NextRequest) {
  const access = await getAccess();
  if (!access) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { tool, args } = await req.json();
  const writeTool = findWriteTool(tool);
  if (!writeTool) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  let result: unknown;
  try {
    result = await executeConfirmedAction(tool, args, access);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Action failed" }, { status: 400 });
  }

  // The underlying actions.ts function already wrote its own audit entry
  // (create/update/etc, attributed to this same real user) — this second
  // entry just makes the AI-assisted origin explicit in the trail.
  await logAudit({
    action: "ai_confirm",
    module: TOOL_MODULE[tool] ?? "settings",
    detail: `Confirmed via AI Assistant: ${writeTool.summarize(args)}`,
  });

  const today = nairobiDateISO();
  await db.insert(aiMessages).values({
    orgId: access.orgId,
    memberId: access.memberId,
    role: "assistant",
    content: `Done — ${writeTool.summarize(args)}.`,
    nairobiDate: today,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ result });
}
