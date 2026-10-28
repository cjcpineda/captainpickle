import type { Part } from "@google/genai";
import type { Captain } from "../auth.ts";
import { createChat, loadMessages, saveMessages, type Message } from "../chats.ts";
import { gemini, MODEL } from "../gemini.ts";
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
  const id = chatId ?? createChat(captain.id, text);
  const messages = loadMessages(captain.id, id);
  if (!messages) throw new Error("Chat not found.");
  emit({ type: "chat", id });

  messages.push({ role: "user", parts: [{ text }] });
  saveMessages(id, messages);

  const context = `Captain: ${captain.name}. Team: ${captain.teamName}. Today: ${new Date().toDateString()}.`;

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = await gemini().models.generateContentStream({
      model: MODEL,
      contents: messages,
      config: {
        systemInstruction: `${SYSTEM}\n\n${context}`,
        tools: [{ functionDeclarations: toolDefinitions }],
      },
    });

    // Keep every part as returned (thought signatures included); Gemini needs them back on the next turn.
    const parts: Part[] = [];
    for await (const chunk of stream) {
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.text && !part.thought) emit({ type: "text", delta: part.text });
        parts.push(part);
      }
    }
    if (parts.length === 0) {
      emit({ type: "error", message: "The strategist couldn't answer that one. Try rephrasing." });
      break;
    }
    messages.push({ role: "model", parts });
    saveMessages(id, messages);

    const calls = parts.flatMap((p) => (p.functionCall ? [p.functionCall] : []));
    if (calls.length === 0) break;

    const responses: Part[] = calls.map((call) => {
      const name = call.name ?? "";
      emit({ type: "status", label: toolStatus(name) });
      return { functionResponse: { id: call.id, name, response: runTool(name, call.args, captain) } };
    });
    messages.push({ role: "user", parts: responses });
    saveMessages(id, messages);
  }

  emit({ type: "done" });
}

/** The visible conversation: captain messages and the strategist's prose, minus tool plumbing. */
export function transcript(messages: Message[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  for (const m of messages) {
    const text = (m.parts ?? []).flatMap((p) => (p.text && !p.thought ? [p.text] : [])).join("");
    if (!text) continue;
    const role = m.role === "model" ? "ai" : "captain";
    const last = items.at(-1);
    if (last?.role === "ai" && role === "ai") last.text += `\n\n${text}`;
    else items.push({ role, text });
  }
  return items;
}
