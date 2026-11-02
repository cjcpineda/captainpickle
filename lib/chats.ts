import type { Content } from "@google/genai";
import { all, get, run } from "./db.ts";

export type Message = Content;
export type ChatSummary = { id: number; title: string; updatedAt: string };

export function listChats(captainId: number): Promise<ChatSummary[]> {
  return all<ChatSummary>(
    "SELECT id, title, updated_at AS updatedAt FROM chats WHERE captain_id = ? ORDER BY updated_at DESC LIMIT 30",
    captainId,
  );
}

export async function createChat(captainId: number, title: string): Promise<number> {
  const row = await get<{ id: number }>("INSERT INTO chats (captain_id, title) VALUES (?, ?) RETURNING id", captainId, title.slice(0, 80));
  return row!.id;
}

export async function loadMessages(captainId: number, chatId: number): Promise<Message[] | null> {
  const row = await get<{ messages: string }>("SELECT messages FROM chats WHERE id = ? AND captain_id = ?", chatId, captainId);
  return row ? (JSON.parse(row.messages) as unknown[]).flatMap(upgradeLegacy) : null;
}

export async function saveMessages(chatId: number, messages: Message[]) {
  await run("UPDATE chats SET messages = ?, updated_at = datetime('now') WHERE id = ?", JSON.stringify(messages), chatId);
}

/** Chats saved before the switch to Gemini used { role, content }; keep their plain-text turns. */
function upgradeLegacy(m: unknown): Message[] {
  const legacy = m as { role?: string; content?: unknown; parts?: unknown };
  if (legacy.parts) return [m as Message];
  if (typeof legacy.content !== "string") return [];
  return [{ role: legacy.role === "assistant" ? "model" : "user", parts: [{ text: legacy.content }] }];
}
