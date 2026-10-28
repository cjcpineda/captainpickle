"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatEvent, TranscriptItem } from "@/lib/strategist/view.ts";
import { Markdown } from "./Markdown.tsx";

const SUGGESTIONS = [
  "Who's on our schedule next?",
  "How did we do against Bounce Philly, round by round?",
  "Which of our pairs won in the last match?",
  "What if I pair Chelsea and CJ in Round 2?",
];

type Props = { chatId: number | null; initial: TranscriptItem[]; prompt?: string };

export function Chat({ chatId: initialChatId, initial, prompt }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState(prompt ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chatId = useRef(initialChatId);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [items, status]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setDraft("");
    setItems((prev) => [...prev, { role: "captain", text }, { role: "ai", text: "" }]);
    setStatus("Thinking");
    let failed = false;

    const appendToReply = (delta: string) =>
      setItems((prev) => [...prev.slice(0, -1), { role: "ai", text: prev[prev.length - 1].text + delta }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatId.current, message: text }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 401 ? "Your session expired. Sign in again." : "Request failed.");

      for await (const event of readEvents(res.body)) {
        if (event.type === "chat" && chatId.current === null) {
          chatId.current = event.id;
          window.history.replaceState(null, "", `/strategist/${event.id}`);
        } else if (event.type === "text") {
          setStatus(null);
          appendToReply(event.delta);
        } else if (event.type === "status") {
          setStatus(event.label);
          appendToReply("\n\n");
        } else if (event.type === "error") {
          failed = true;
          appendToReply(`\n\n**${event.message}**`);
        }
      }
    } catch (err) {
      failed = true;
      appendToReply(`**${err instanceof Error ? err.message : "Something went wrong."}**`);
    } finally {
      setStatus(null);
      setBusy(false);
      // Refresh the sidebar with the saved chat — unless that would wipe an error the captain hasn't seen.
      if (!failed) router.refresh();
    }
  }

  return (
    <section className="card chat">
      <div className="messages">
        {items.length === 0 && (
          <div className="welcome">
            <div className="kicker">AI Strategist</div>
            <h2>Talk lineups</h2>
            <p>Ask about your schedule, past match sheets, and how your pairs have played. Then build a lineup for all eight rounds.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((item, i) =>
          item.text.trim() ? (
            <div key={i} className={`msg ${item.role}`}>
              <div className="who-label">{item.role === "captain" ? "Captain" : "AI Strategist"}</div>
              <div className="bubble">{item.role === "ai" ? <Markdown text={item.text} /> : item.text}</div>
            </div>
          ) : null,
        )}
        {status && <div className="status">{status}…</div>}
        <div ref={bottom} />
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          placeholder="We're playing Bounce Philly this week. Recommend our lineup for all eight rounds."
          aria-label="Message the AI strategist"
        />
        <button className="button" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}

async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) if (line) yield JSON.parse(line);
  }
}
