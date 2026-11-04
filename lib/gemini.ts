import { ApiError, GoogleGenAI } from "@google/genai";

/** Override with GEMINI_MODEL; the default alias tracks Google's current Flash model, which has a free tier. */
export const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

export class MissingKeyError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set.");
  }
}

const globalForGemini = globalThis as unknown as { gemini?: GoogleGenAI };

export function gemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new MissingKeyError();
  return (globalForGemini.gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
}

/** Gemini errors that usually clear up on their own (overloaded or briefly down). */
function isTransient(err: unknown): boolean {
  return err instanceof ApiError && [500, 502, 503, 504].includes(err.status);
}

/** Runs a Gemini call, retrying transient failures with backoff (1s, 2s, 4s). */
export async function withRetry<T>(call: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await call();
    } catch (err) {
      if (i >= attempts || !isTransient(err)) throw err;
      console.warn(`Gemini call failed (attempt ${i}/${attempts}), retrying:`, err);
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (i - 1)));
    }
  }
}

/** Gemini's own explanation, pulled out of the JSON body the SDK puts in ApiError.message. */
function geminiReason(err: ApiError): string {
  const match = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(err.message);
  const reason = match ? match[1].replace(/\\(.)/g, "$1") : err.message;
  return reason.length > 200 ? `${reason.slice(0, 200)}…` : reason;
}

/** A message a captain can act on, for any error thrown while calling Gemini. */
export function describeAiError(err: unknown): string {
  if (err instanceof MissingKeyError) return "The AI isn't set up yet. Add GEMINI_API_KEY to the server's environment.";
  if (err instanceof ApiError) {
    if (err.status === 429) return "Gemini's free-tier limit was reached. Wait a minute and try again.";
    if ([400, 401, 403].includes(err.status) && /key/i.test(err.message)) return "Gemini rejected the API key. Check GEMINI_API_KEY.";
    if (isTransient(err)) return `Gemini is overloaded right now (${err.status}). Wait a minute and try again.`;
    return `The AI service had a problem (${err.status}: ${geminiReason(err)}). Try again, or start a new chat.`;
  }
  return "Something went wrong. Try again.";
}
