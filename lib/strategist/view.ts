/** Shapes shared with the browser. Kept free of server imports so client components can use them. */

export type TranscriptItem = { role: "captain" | "ai"; text: string };

/** Streamed from /api/chat as newline-delimited JSON. */
export type ChatEvent =
  | { type: "chat"; id: number }
  | { type: "text"; delta: string }
  | { type: "status"; label: string }
  | { type: "error"; message: string }
  | { type: "done" };
