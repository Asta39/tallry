import Groq from "groq-sdk";
import {
  MARKETING_ASSISTANT_MODEL,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_MESSAGE_LENGTH,
  REFUSAL_MESSAGE,
  FALLBACK_ERROR_MESSAGE,
  buildSystemPrompt,
  guardMessage,
  replyLooksLikeDisclosure,
  validateMessage,
} from "./marketing-assistant-rules";

/**
 * Orchestration for the public marketing-site AI assistant. Deliberately
 * has NO import of `@/db`, `@/lib/access`, or `@/lib/ai/tools` — this
 * assistant must be structurally incapable of reaching real org/customer
 * data, not just instructed not to. See marketing-assistant-rules.ts for
 * the topic scope, refusal copy, and prompt-injection guards.
 */

export type MarketingChatMessage = { role: "user" | "assistant"; content: string };

export interface MarketingChatResult {
  reply: string;
  refused: boolean;
  /** Which provider actually answered — "none" means both are unavailable
   *  and the caller got FALLBACK_ERROR_MESSAGE. Exposed mainly so this is
   *  observable in tests/manual checks, not shown in the UI. */
  provider: "groq" | "gemini" | "none";
}

const GEMINI_MODEL = "gemini-3.6-flash";

function sanitizeHistory(history: unknown): MarketingChatMessage[] {
  if (!Array.isArray(history)) return [];
  const cleaned: MarketingChatMessage[] = [];
  for (const item of history.slice(-MAX_HISTORY_MESSAGES)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as any).role;
    const content = (item as any).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.length > MAX_HISTORY_MESSAGE_LENGTH ? content.slice(0, MAX_HISTORY_MESSAGE_LENGTH) + "…" : content;
    cleaned.push({ role, content: trimmed });
  }
  return cleaned;
}

/** Short, honest addendum built from real (never fabricated) aggregate
 *  topic counts — see marketing-chat-memory.ts. Kept as plain text passed
 *  in from the caller so this file never has to import `@/db` itself. */
function topicsHintMessage(topicsHint: string | null | undefined): string | null {
  if (!topicsHint) return null;
  return (
    "For light context only, not a fact to state outright: across recent visitors, the most common topics have " +
    "been " + topicsHint + ". You may let this naturally shape which related detail you volunteer, but only when " +
    "it's actually relevant to what THIS visitor asked — never announce this statistic to them directly."
  );
}

/** Calls Groq. Throws on any failure (missing key, network error, rate
 *  limit, empty reply) so the caller can fall back to Gemini. */
async function callGroq(message: string, history: MarketingChatMessage[], topicsHint: string | null | undefined): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY missing");

  const client = new Groq({ apiKey });
  const hint = topicsHintMessage(topicsHint);
  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt() },
    ...(hint ? [{ role: "system", content: hint } as Groq.Chat.Completions.ChatCompletionMessageParam] : []),
    ...history.map((h) => ({ role: h.role, content: h.content }) as Groq.Chat.Completions.ChatCompletionMessageParam),
    { role: "user", content: message },
  ];

  const response = await client.chat.completions.create({
    model: MARKETING_ASSISTANT_MODEL,
    messages,
    // No `tools` — this assistant has nothing to call. Keeping it a pure
    // chat completion is itself a safeguard: there is no function-call
    // path that could ever be wired to real data by mistake.
    temperature: 0.4,
    max_tokens: 400,
  });

  const reply = response.choices[0]?.message?.content?.trim();
  if (!reply) throw new Error("Empty Groq reply");
  return reply;
}

/** Calls Gemini as the fallback provider when Groq is unavailable or
 *  overwhelmed. Same no-tools, no-db-access shape as callGroq — plain REST
 *  call, matching the pattern already used in src/lib/receipts/scan.ts. */
async function callGemini(message: string, history: MarketingChatMessage[], topicsHint: string | null | undefined): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const hint = topicsHintMessage(topicsHint);
  const systemText = hint ? buildSystemPrompt() + "\n\n" + hint : buildSystemPrompt();
  const contents = [
    ...history.map((h) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
    { role: "user", parts: [{ text: message }] },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);

  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!reply) throw new Error("Empty Gemini reply");
  return reply;
}

/**
 * Runs one turn of the marketing assistant. Validates and guards the
 * message before it ever reaches a model; on any ambiguity or failure,
 * falls back to a safe canned response rather than surfacing an error or
 * letting an ungated reply through.
 *
 * Provider order: Groq first (cheap, fast, already used by the in-app
 * assistant), then Gemini automatically whenever Groq is unavailable
 * (missing key, network error) or overwhelmed (rate-limited, 5xx). Only
 * if both fail does this return FALLBACK_ERROR_MESSAGE.
 */
export async function runMarketingAssistantTurn(
  rawMessage: unknown,
  rawHistory: unknown,
  topicsHint?: string | null
): Promise<MarketingChatResult> {
  const validated = validateMessage(rawMessage);
  if (!validated.ok || !validated.cleaned) {
    return { reply: validated.error ?? FALLBACK_ERROR_MESSAGE, refused: true, provider: "none" };
  }
  const message = validated.cleaned;

  const refusalReason = guardMessage(message);
  if (refusalReason) {
    return { reply: refusalReason, refused: true, provider: "none" };
  }

  const history = sanitizeHistory(rawHistory);

  let reply: string;
  let provider: "groq" | "gemini";
  try {
    reply = await callGroq(message, history, topicsHint);
    provider = "groq";
  } catch {
    try {
      reply = await callGemini(message, history, topicsHint);
      provider = "gemini";
    } catch {
      return { reply: FALLBACK_ERROR_MESSAGE, refused: false, provider: "none" };
    }
  }

  if (replyLooksLikeDisclosure(reply)) {
    return { reply: REFUSAL_MESSAGE, refused: true, provider };
  }

  return { reply, refused: false, provider };
}

// ---------------------------------------------------------------------
// Rate limiting — simple in-memory sliding window, keyed by caller (IP).
// Best-effort only: state is per server instance and resets on redeploy,
// which is an acceptable tradeoff for a public marketing FAQ endpoint
// with no data access. Exported as a class so tests can use isolated
// instances instead of sharing the module-level singleton.
// ---------------------------------------------------------------------

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  /** Returns true if the request is allowed, false if the caller is over the limit. */
  allow(key: string, now: number = Date.now()): boolean {
    const windowStart = now - this.windowMs;
    const existing = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    if (existing.length >= this.maxRequests) {
      this.hits.set(key, existing);
      return false;
    }
    existing.push(now);
    this.hits.set(key, existing);
    return true;
  }

  reset(): void {
    this.hits.clear();
  }
}

/** Shared limiter for the live route: 8 messages per 30 seconds per caller. */
export const marketingChatRateLimiter = new RateLimiter(8, 30_000);
