import { NextRequest, NextResponse } from "next/server";
import { runMarketingAssistantTurn, marketingChatRateLimiter } from "@/lib/ai/marketing-assistant";
import { RATE_LIMIT_MESSAGE } from "@/lib/ai/marketing-assistant-rules";
import { classifyTopic, getTopTopicsHint, logTopic } from "@/lib/ai/marketing-chat-memory";

/**
 * Public endpoint for the landing-page AI assistant. Unauthenticated by
 * design (it's on the marketing site) but intentionally has no access to
 * `@/lib/access` or `@/lib/ai/tools` — see marketing-assistant.ts for the
 * rationale. The only db-backed import here is marketing-chat-memory,
 * which touches nothing but its own aggregate-only, no-PII topics table —
 * do not add any other db-backed import to this route.
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

  const topicsHint = await getTopTopicsHint();
  const result = await runMarketingAssistantTurn(message, history, topicsHint);

  // Log after the fact, and only for a real answer — never for a refusal
  // or error, so the aggregate topic counts reflect genuine product
  // questions rather than injection attempts or empty/failed turns.
  if (!result.refused && result.provider !== "none" && typeof message === "string") {
    void logTopic(classifyTopic(message));
  }

  return NextResponse.json({ reply: result.reply, refused: result.refused });
}
