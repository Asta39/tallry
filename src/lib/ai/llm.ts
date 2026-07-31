import Groq from "groq-sdk";
import { ALL_TOOLS, findWriteTool, type ToolDef } from "./tools";
import type { Access } from "@/lib/access";
import { nairobiDateISO } from "@/lib/timezone";

// llama-3.3-70b-versatile reliably mis-formatted tool calls against our
// nested array-of-objects schemas (draftInvoice's `lines`, etc) — emitted a
// pseudo-XML <function=...> tag instead of a real tool_calls entry, 100% of
// the time in testing, not intermittently. openai/gpt-oss-20b (also free on
// Groq) calls the same schemas correctly every time tested.
const MODEL = "openai/gpt-oss-20b";
const MAX_TOOL_ROUNDS = 5;

export type ChatMessage = { role: "user" | "assistant"; content: string };

function toGroqTool(tool: ToolDef): Groq.Chat.Completions.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown>,
    },
  };
}

export interface PendingAction {
  tool: string;
  args: any;
  humanSummary: string;
}

export interface AssistantTurnResult {
  reply: string;
  toolCalls: { tool: string; args: any; result: unknown }[];
  pendingAction: PendingAction | null;
}

function systemPrompt(): string {
  const today = nairobiDateISO();
  return (
    "You are the accounting assistant inside Zeno, a Kenyan business accounting app. " +
    `Today's date is ${today} — use this for any date field unless the user gives a different one. Never guess a date. ` +
    "Answer using the provided tools — never invent financial figures, IDs, dates, or any other value. " +
    "Before drafting an invoice, quote, or bill for a named customer or vendor, you MUST call searchContacts first " +
    "to find their real contactId — never fabricate a contactId. If searchContacts returns no match, tell the user " +
    "no such contact exists instead of proceeding. If it returns multiple matches, ask the user which one they mean " +
    "instead of guessing. " +
    "Amounts are in cents; convert to KES (divide by 100) when speaking to the user. Be concise and direct."
  );
}

/**
 * Runs one user turn against Groq with function-calling enabled.
 * Read tools execute immediately and their results are fed back to the model
 * so it can keep reasoning; the first WRITE tool call halts the loop and is
 * returned as a pendingAction for the UI to confirm/reject — it is never
 * executed here.
 */
export async function runAssistantTurn(
  history: ChatMessage[],
  userMessage: string,
  access: Access
): Promise<AssistantTurnResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("AI assistant is not configured (missing GROQ_API_KEY)");

  const client = new Groq({ apiKey });
  const tools = ALL_TOOLS.map(toGroqTool);

  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt() },
    ...history.map((h) => ({ role: h.role, content: h.content }) as Groq.Chat.Completions.ChatCompletionMessageParam),
    { role: "user", content: userMessage },
  ];

  const toolCalls: AssistantTurnResult["toolCalls"] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response;
    try {
      response = await client.chat.completions.create({ model: MODEL, messages, tools, tool_choice: "auto" });
    } catch (e) {
      // Llama-family models on Groq occasionally emit a malformed tool call
      // (e.g. an XML-ish <function=...> tag instead of a real tool_calls
      // entry) that the strict parser rejects with 400 tool_use_failed.
      // One retry clears it most of the time; if it doesn't, fail with a
      // message the user can act on instead of a raw 500.
      const isToolUseFailed = e instanceof Groq.APIError && e.status === 400 && String((e as any).error?.error?.code) === "tool_use_failed";
      if (!isToolUseFailed) throw e;
      try {
        response = await client.chat.completions.create({ model: MODEL, messages, tools, tool_choice: "auto" });
      } catch {
        return { reply: "I had trouble forming that request — try rephrasing, or ask me one thing at a time.", toolCalls, pendingAction: null };
      }
    }

    const choice = response.choices[0];
    const calls = choice.message.tool_calls;
    if (!calls || calls.length === 0) {
      return { reply: choice.message.content ?? "", toolCalls, pendingAction: null };
    }

    // Only ever act on the first call per round — write tools must halt
    // immediately rather than let the model batch multiple mutations blind.
    const call = calls[0];
    const args = JSON.parse(call.function.arguments || "{}");
    const writeTool = findWriteTool(call.function.name);
    if (writeTool) {
      return {
        reply: choice.message.content ?? "",
        toolCalls,
        pendingAction: { tool: call.function.name, args, humanSummary: writeTool.summarize(args) },
      };
    }

    const tool = ALL_TOOLS.find((t) => t.name === call.function.name);
    if (!tool) {
      return { reply: `I tried to use an unknown tool (${call.function.name}).`, toolCalls, pendingAction: null };
    }

    let result: unknown;
    try {
      result = await tool.run(args, access);
    } catch (e) {
      result = { error: e instanceof Error ? e.message : "Tool call failed" };
    }
    toolCalls.push({ tool: call.function.name, args, result });

    messages.push(choice.message);
    messages.push({ role: "tool", content: JSON.stringify(result), tool_call_id: call.id });
  }

  return { reply: "I wasn't able to finish that in a reasonable number of steps — try rephrasing or breaking it into smaller questions.", toolCalls, pendingAction: null };
}

/** Re-runs a single write tool for real, after the user has confirmed it. */
export async function executeConfirmedAction(tool: string, args: any, access: Access) {
  const writeTool = findWriteTool(tool);
  if (!writeTool) throw new Error("Unknown or non-write tool");
  if (!access.perms.has(writeTool.requiredPerm)) throw new Error(`Not authorized: missing "${writeTool.requiredPerm}" permission`);
  return writeTool.run(args, access);
}
