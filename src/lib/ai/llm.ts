import Groq from "groq-sdk";
import { ALL_TOOLS, findWriteTool, type ToolDef } from "./tools";
import type { Access } from "@/lib/access";

// llama-3.3-70b-versatile: generous free tier (~30 req/min, thousands/day) —
// swapped in after Gemini's free tier turned out to cap at 5 req/min on
// whatever model its "-latest" alias happened to resolve to that week.
const MODEL = "llama-3.3-70b-versatile";
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

const SYSTEM_PROMPT =
  "You are the accounting assistant inside Zeno, a Kenyan business accounting app. " +
  "Answer using the provided tools — never invent financial figures. Amounts are in cents; " +
  "convert to KES (divide by 100) when speaking to the user. Be concise and direct.";

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
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((h) => ({ role: h.role, content: h.content }) as Groq.Chat.Completions.ChatCompletionMessageParam),
    { role: "user", content: userMessage },
  ];

  const toolCalls: AssistantTurnResult["toolCalls"] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
    });

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
