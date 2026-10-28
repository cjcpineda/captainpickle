import { GoogleGenAI } from "@google/genai";

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
