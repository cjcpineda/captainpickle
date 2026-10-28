import { ApiError } from "@google/genai";
import { z } from "zod";
import { currentCaptain } from "@/lib/auth.ts";
import { MissingKeyError } from "@/lib/gemini.ts";
import { runStrategist } from "@/lib/strategist/agent.ts";
import type { ChatEvent } from "@/lib/strategist/view.ts";

const Body = z.object({ chatId: z.number().int().nullable(), message: z.string().trim().min(1).max(4000) });

export async function POST(request: Request) {
  const captain = await currentCaptain();
  if (!captain) return new Response("Unauthorized", { status: 401 });

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return new Response("Bad request", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await runStrategist(captain, body.data.chatId, body.data.message, emit);
      } catch (err) {
        console.error(err);
        emit({ type: "error", message: describe(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}

function describe(err: unknown): string {
  if (err instanceof MissingKeyError) return "The AI isn't set up yet. Add GEMINI_API_KEY to the server's environment.";
  if (err instanceof ApiError) {
    if (err.status === 429) return "Gemini's free-tier limit was reached. Wait a minute and try again.";
    if ([400, 401, 403].includes(err.status) && /key/i.test(err.message)) return "Gemini rejected the API key. Check GEMINI_API_KEY.";
    return "The AI service had a problem. Try again.";
  }
  return "Something went wrong. Try again.";
}
