import { GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import { ALL_TOOLS, findWriteTool, type ToolDef } from "./tools";
import type { Access } from "@/lib/access";

const MODEL = "gemini-2.5-flash";
const MAX_TOOL_ROUNDS = 5;

function toFunctionDeclaration(tool: ToolDef): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    // parametersJsonSchema accepts plain JSON Schema (lowercase "object"/"string"/...) —
    // the tool defs are already written in that shape, no re-mapping needed.
    parametersJsonSchema: tool.parameters,
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

/**
 * Runs one user turn against Gemini with function-calling enabled.
 * Read tools execute immediately and their results are fed back to the model
 * so it can keep reasoning; the first WRITE tool call halts the loop and is
 * returned as a pendingAction for the UI to confirm/reject — it is never
 * executed here.
 */
export async function runAssistantTurn(
  history: Content[],
  userMessage: string,
  access: Access
): Promise<AssistantTurnResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI assistant is not configured (missing GEMINI_API_KEY)");

  const ai = new GoogleGenAI({ apiKey });
  const functionDeclarations = ALL_TOOLS.map(toFunctionDeclaration);

  const contents: Content[] = [...history, { role: "user", parts: [{ text: userMessage }] }];
  const toolCalls: AssistantTurnResult["toolCalls"] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        tools: [{ functionDeclarations }],
        systemInstruction:
          "You are the accounting assistant inside Zeno, a Kenyan business accounting app. " +
          "Answer using the provided tools — never invent financial figures. Amounts are in cents; " +
          "convert to KES (divide by 100) when speaking to the user. Be concise and direct.",
      },
    });

    const calls = response.functionCalls;
    if (!calls || calls.length === 0) {
      return { reply: response.text ?? "", toolCalls, pendingAction: null };
    }

    // Only ever act on the first call per round — write tools must halt
    // immediately rather than let the model batch multiple mutations blind.
    const call = calls[0];
    const writeTool = findWriteTool(call.name!);
    if (writeTool) {
      return {
        reply: response.text ?? "",
        toolCalls,
        pendingAction: { tool: call.name!, args: call.args, humanSummary: writeTool.summarize(call.args) },
      };
    }

    const tool = ALL_TOOLS.find((t) => t.name === call.name);
    if (!tool) {
      return { reply: `I tried to use an unknown tool (${call.name}).`, toolCalls, pendingAction: null };
    }

    let result: unknown;
    try {
      result = await tool.run(call.args, access);
    } catch (e) {
      result = { error: e instanceof Error ? e.message : "Tool call failed" };
    }
    toolCalls.push({ tool: call.name!, args: call.args, result });

    contents.push({ role: "model", parts: [{ functionCall: { name: call.name, args: call.args } }] });
    contents.push({ role: "user", parts: [{ functionResponse: { name: call.name!, response: { result } } }] });
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
