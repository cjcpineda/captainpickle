import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { currentCaptain } from "@/lib/auth.ts";
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
  if (err instanceof Anthropic.AuthenticationError) return "The AI service isn't configured. Set ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "The AI service is busy. Try again in a moment.";
  if (err instanceof Anthropic.APIError) return "The AI service had a problem. Try again.";
  if (err instanceof Anthropic.AnthropicError) return "Couldn't reach the AI service. Check ANTHROPIC_API_KEY.";
  return "Something went wrong. Try again.";
}
