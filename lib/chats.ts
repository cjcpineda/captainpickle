import type { ChatMessage } from "./ai.ts";
import { all, get, run } from "./db.ts";

export type Message = ChatMessage;
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

/**
 * Chats saved while the strategist ran on Gemini used { role: "user" | "model", parts }; keep their
 * plain-text turns and drop the tool plumbing, which Workers AI can't replay.
 */
function upgradeLegacy(m: unknown): Message[] {
  const legacy = m as { role?: string; parts?: { text?: string; thought?: boolean }[] };
  if (!legacy.parts) return [m as Message];
  const text = legacy.parts.flatMap((p) => (p.text && !p.thought ? [p.text] : [])).join("");
  if (!text) return [];
  return [legacy.role === "model" ? { role: "assistant", content: text } : { role: "user", content: text }];
}
