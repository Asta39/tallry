import { NextRequest, NextResponse } from "next/server";
import { runMarketingAssistantTurn, marketingChatRateLimiter } from "@/lib/ai/marketing-assistant";
import { RATE_LIMIT_MESSAGE } from "@/lib/ai/marketing-assistant-rules";

/**
 * Public endpoint for the landing-page AI assistant. Unauthenticated by
 * design (it's on the marketing site) but intentionally has no access to
 * `@/db`, `@/lib/access`, or `@/lib/ai/tools` — see marketing-assistant.ts
 * for the rationale. Do not add any of those imports here.
 */

export const dynamic = "force-dynamic";

function callerKey(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const key = callerKey(req);
  if (!marketingChatRateLimiter.allow(key)) {
    return NextResponse.json({ reply: RATE_LIMIT_MESSAGE, refused: true }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, history } = body as { message?: unknown; history?: unknown };

  const result = await runMarketingAssistantTurn(message, history);
  return NextResponse.json({ reply: result.reply, refused: result.refused });
}
