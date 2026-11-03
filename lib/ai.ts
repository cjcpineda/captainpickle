/**
 * Cloudflare Workers AI, through the Worker's `AI` binding (see wrangler.jsonc). No API key needed:
 * usage is billed to the Cloudflare account, which includes a free daily allocation.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** The strategist's model; it needs solid tool calling. Override with AI_MODEL. */
export const MODEL = process.env.AI_MODEL ?? "@cf/zai-org/glm-4.7-flash";

/** Reads photos of scoresheets. Override with AI_VISION_MODEL. */
export const VISION_MODEL = process.env.AI_VISION_MODEL ?? "@cf/meta/llama-4-scout-17b-16e-instruct";

export type ChatMessage = ChatCompletionMessageParam;
export type ToolCall = ChatCompletionMessageFunctionToolCall;
export type ToolDefinition = ChatCompletionFunctionTool;

function binding(): Ai {
  const found = getCloudflareContext().env.AI;
  if (!found) throw new AiSetupError();
  return found;
}

export class AiSetupError extends Error {
  constructor() {
    super("The Workers AI binding (AI) is missing.");
  }
}

type ChatInput = { messages: ChatMessage[]; tools?: ToolDefinition[]; response_format?: unknown; max_tokens?: number };

/** One chat-completions call (OpenAI format) against a Workers AI model. */
export async function chat(input: ChatInput, model = MODEL): Promise<ChatCompletionResponseMessage> {
  // The model is configurable, so call through the untyped overload; every chat model shares this format.
  const run = binding().run as unknown as (model: string, input: ChatInput) => Promise<ChatCompletionsOutput>;
  const output = await run(model, input);
  const message = output.choices?.[0]?.message;
  if (!message) throw new Error(`Workers AI returned no answer: ${JSON.stringify(output).slice(0, 300)}`);
  return message;
}

/** Turns a PDF (or other document) into text the model can read. */
export async function toText(name: string, type: string, bytes: Uint8Array): Promise<string> {
  const result = await binding().toMarkdown({ name, blob: new Blob([new Uint8Array(bytes)], { type }) });
  if (result.format === "error") throw new Error(result.error);
  return result.data;
}

/** A message a captain can act on, for any error thrown while calling Workers AI. */
export function describeAiError(err: unknown): string {
  if (err instanceof AiSetupError) return "The AI isn't set up yet. Add the AI binding in wrangler.jsonc and redeploy.";
  const message = err instanceof Error ? err.message : String(err);
  if (/neurons|daily free allocation|4006/i.test(message)) {
    return "Today's free Workers AI allowance is used up. It resets at midnight UTC, or enable Workers Paid.";
  }
  if (/capacity|3040|overloaded|too many requests|429/i.test(message)) return "The AI is busy right now. Wait a moment and try again.";
  if (/no such model|5007|not found/i.test(message)) return `Workers AI doesn't know the model "${MODEL}". Check AI_MODEL.`;
  return `The AI service had a problem (${message.slice(0, 200)}). Try again.`;
}
