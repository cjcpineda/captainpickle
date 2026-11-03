import { chat, MODEL, type ChatMessage, type ToolCall } from "../ai.ts";
import type { Captain } from "../auth.ts";
import { createChat, loadMessages, saveMessages, type Message } from "../chats.ts";
import { runTool, toolDefinitions, toolStatus } from "./tools.ts";
import type { ChatEvent, TranscriptItem } from "./view.ts";

const MAX_STEPS = 10;

const SYSTEM = `You are the AI lineup strategist for a team in the Cross Club Pickleball league. You talk with the team's captain.

League format: every match is 8 rounds of 4 games. Odd rounds (1, 3, 5, 7) are mixed doubles: each pair is one woman and one man. Even rounds (2, 4, 6, 8) are gendered: games 1-2 are women's doubles, games 3-4 are men's doubles. A player plays at most one game per round.

Lineup deadlines: the away team submits its lineup two nights before the match and the home team the night before, always at 7:30 PM Eastern. After that the lineup is locked.

How to work:
- Look things up with your tools before answering. Never invent players, scores, results, or dates.
- When you recommend a lineup, give every round with the format and four pairs, and say which opposing pairs you expect when the data shows them. Check that every pair is legal for its round.
- For counter-pairings, start from the opponent's scouting report: match our strongest pairs against their likely pairs where it helps most, and say which of their pairs each of ours is meant to counter.
- Our team mixes up pairings in practice and uploads those games. Use practice results to judge pairs, especially pairs with little league history, but weigh league games more: practice is against teammates and is often played to 11 rather than 21.
- Be upfront about how much data a recommendation rests on. One match is a small sample: say so, and don't put a precise win percentage on anything the data can't support.
- Schedules, rosters and results are synced from the CPL website. If something is missing, say what's missing rather than guessing.

Style: write like a sharp sports analyst: short, confident, no filler. Use **bold** for player pairs and short bullet lists. Use plain text, not tables.`;

type Emit = (event: ChatEvent) => void;

export async function runStrategist(captain: Captain, chatId: number | null, text: string, emit: Emit) {
  const id = chatId ?? (await createChat(captain.id, text));
  const messages = await loadMessages(captain.id, id);
  if (!messages) throw new Error("Chat not found.");
  emit({ type: "chat", id });

  messages.push({ role: "user", content: text });
  await saveMessages(id, messages);

  const context = `Captain: ${captain.name}. Team: ${captain.teamName}. Today: ${new Date().toDateString()}.`;
  const system: ChatMessage = { role: "system", content: `${SYSTEM}\n\n${context}` };

  for (let step = 0; ; step++) {
    if (step === MAX_STEPS) {
      emit({ type: "error", message: "The strategist ran out of steps on that one. Try a narrower question." });
      break;
    }
    const reply = await chat({ messages: [system, ...messages], tools: toolDefinitions, max_tokens: 4096 });
    const calls = (reply.tool_calls ?? []).filter((c): c is ToolCall => c.type === "function");
    const content = visibleText(reply.content);

    if (!content && calls.length === 0) {
      emit({ type: "error", message: `The strategist (${MODEL}) couldn't answer that one. Try rephrasing.` });
      break;
    }
    if (content) emit({ type: "text", delta: content });
    messages.push({ role: "assistant", content: content || null, ...(calls.length ? { tool_calls: calls } : {}) });
    await saveMessages(id, messages);
    if (calls.length === 0) break;

    for (const call of calls) {
      emit({ type: "status", label: toolStatus(call.function.name) });
      const result = await runTool(call.function.name, parseArgs(call.function.arguments), captain);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
    await saveMessages(id, messages);
  }

  emit({ type: "done" });
}

function parseArgs(args: unknown): unknown {
  if (typeof args !== "string") return args ?? {};
  try {
    return args.trim() ? JSON.parse(args) : {};
  } catch {
    return {};
  }
}

/** The answer text, minus any reasoning a model inlined in <think> tags. */
function visibleText(content: unknown): string {
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => p?.text ?? "").join("") : "";
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^[\s\S]*<\/think>/, "").trim();
}

/** The visible conversation: captain messages and the strategist's prose, minus tool plumbing. */
export function transcript(messages: Message[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = m.role === "assistant" ? visibleText(m.content) : typeof m.content === "string" ? m.content : "";
    if (!text) continue;
    const role = m.role === "assistant" ? "ai" : "captain";
    const last = items.at(-1);
    if (last?.role === "ai" && role === "ai") last.text += `\n\n${text}`;
    else items.push({ role, text });
  }
  return items;
}
