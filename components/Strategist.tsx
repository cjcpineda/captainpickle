import Link from "next/link";
import { notFound } from "next/navigation";
import type { Captain } from "@/lib/auth.ts";
import { listChats, loadMessages } from "@/lib/chats.ts";
import { transcript } from "@/lib/strategist/agent.ts";
import { Chat } from "./Chat.tsx";

type Props = { captain: Captain; chatId: number | null; prompt?: string };

export function Strategist({ captain, chatId, prompt }: Props) {
  const messages = chatId === null ? [] : loadMessages(captain.id, chatId);
  if (!messages) notFound();
  const chats = listChats(captain.id);

  return (
    <div className="chat-layout">
      <aside className="card">
        <div className="card-head">
          <h2>Chats</h2>
          <Link href="/strategist" className="sub">
            + New
          </Link>
        </div>
        <ul className="chat-list">
          {chats.length === 0 && <li className="sub">No chats yet.</li>}
          {chats.map((c) => (
            <li key={c.id}>
              <Link href={`/strategist/${c.id}`} aria-current={c.id === chatId ? "page" : undefined}>
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <Chat key={chatId ?? "new"} chatId={chatId} initial={transcript(messages)} prompt={prompt} />
    </div>
  );
}
