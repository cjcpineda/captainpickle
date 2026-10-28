import type Anthropic from "@anthropic-ai/sdk";
import { db } from "./db.ts";

export type Message = Anthropic.Beta.BetaMessageParam;
export type ChatSummary = { id: number; title: string; updatedAt: string };

export function listChats(captainId: number): ChatSummary[] {
  return db()
    .prepare("SELECT id, title, updated_at AS updatedAt FROM chats WHERE captain_id = ? ORDER BY updated_at DESC LIMIT 30")
    .all(captainId) as ChatSummary[];
}

export function createChat(captainId: number, title: string): number {
  const { lastInsertRowid } = db().prepare("INSERT INTO chats (captain_id, title) VALUES (?, ?)").run(captainId, title.slice(0, 80));
  return Number(lastInsertRowid);
}

export function loadMessages(captainId: number, chatId: number): Message[] | null {
  const row = db().prepare("SELECT messages FROM chats WHERE id = ? AND captain_id = ?").get(chatId, captainId) as
    | { messages: string }
    | undefined;
  return row ? JSON.parse(row.messages) : null;
}

export function saveMessages(chatId: number, messages: Message[]) {
  db()
    .prepare("UPDATE chats SET messages = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(messages), chatId);
}
