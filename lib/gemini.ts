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

/** A message a captain can act on, for any error thrown while calling Gemini. */
export function describeAiError(err: unknown): string {
  if (err instanceof MissingKeyError) return "The AI isn't set up yet. Add GEMINI_API_KEY to the server's environment.";
  if (err instanceof ApiError) {
    if (err.status === 429) return "Gemini's free-tier limit was reached. Wait a minute and try again.";
    if ([400, 401, 403].includes(err.status) && /key/i.test(err.message)) return "Gemini rejected the API key. Check GEMINI_API_KEY.";
    if (err.status === 503) return "Gemini is overloaded right now. Wait a moment and try again.";
    if (err.status === 404) return `Gemini doesn't know the model "${MODEL}". Check GEMINI_MODEL.`;
    return `The AI service had a problem (Gemini ${err.status}: ${geminiMessage(err)}). Try again.`;
  }
  return "Something went wrong. Try again.";
}

/** Gemini's own explanation, pulled out of the JSON body the SDK puts in the error message. */
function geminiMessage(err: ApiError): string {
  const match = err.message.match(/"message":\s*"((?:[^"\\]|\\.)*)"/);
  const text = match ? match[1].replace(/\\n/g, " ").replace(/\\"/g, '"') : err.message;
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}
