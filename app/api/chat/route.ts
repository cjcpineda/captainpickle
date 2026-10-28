import { z } from "zod";
import { currentCaptain } from "@/lib/auth.ts";
import { describeAiError } from "@/lib/gemini.ts";
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
        emit({ type: "error", message: describeAiError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
