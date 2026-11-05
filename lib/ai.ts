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
  const ai = binding();
  const run = ai.run.bind(ai) as unknown as (model: string, input: ChatInput) => Promise<ChatCompletionsOutput>;
  const output = await withRetry(() => run(model, input));
  const message = output.choices?.[0]?.message;
  if (!message) throw new Error(`Workers AI returned no answer: ${JSON.stringify(output).slice(0, 300)}`);
  return message;
}

/** Workers AI errors that usually clear up on their own: model at capacity, rate limited, or briefly down. */
function isBusy(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /capacity|3040|overloaded|too many requests|429|50[234]|timed? ?out/i.test(message);
}

/** Retries busy errors with backoff (1s, 2s, 4s) before giving up. */
async function withRetry<T>(call: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await call();
    } catch (err) {
      if (i >= attempts || !isBusy(err)) throw err;
      console.warn(`Workers AI call failed (attempt ${i}/${attempts}), retrying:`, err);
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (i - 1)));
    }
  }
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
