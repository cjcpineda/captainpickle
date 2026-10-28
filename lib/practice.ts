/**
 * Practice data: captains upload a file of practice games, check how it was read, then save it.
 *
 * A CSV in our template is read directly. Anything else (another spreadsheet layout, a PDF,
 * a photo of a scoresheet, notes) goes to Gemini, which pulls out the games.
 */
import { z } from "zod";
import { parseCsv } from "./csv.ts";
import { gemini, MODEL } from "./gemini.ts";
import { insertMatch } from "./repo.ts";

export const TEMPLATE_COLUMNS = ["date", "player_a1", "player_a2", "player_b1", "player_b2", "score_a", "score_b"];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const AI_READABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);

export const PracticeGame = z.object({
  playedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  a: z.tuple([z.string().min(1), z.string().min(1)]),
  b: z.tuple([z.string().min(1), z.string().min(1)]),
  scoreA: z.number().int().min(0),
  scoreB: z.number().int().min(0),
});
export type PracticeGame = z.infer<typeof PracticeGame>;

export type Upload = { name: string; type: string; bytes: Buffer };

/** A problem with the file itself, worded for the captain. */
export class PracticeFileError extends Error {}

export async function readPracticeFile(file: Upload, roster: string[]): Promise<PracticeGame[]> {
  const isText = file.type.startsWith("text/") || /\.(csv|txt|tsv)$/i.test(file.name);
  if (isText) {
    const text = file.bytes.toString("utf8");
    return readTemplateCsv(text) ?? extractWithAi({ text }, roster);
  }
  if (AI_READABLE.has(file.type)) {
    return extractWithAi({ inlineData: { mimeType: file.type, data: file.bytes.toString("base64") } }, roster);
  }
  throw new PracticeFileError("Upload a CSV, text file, PDF, or photo. For Excel, use File → Save As → CSV.");
}

/** Our template, read exactly; returns null for any other layout so the AI can take it. */
export function readTemplateCsv(text: string): PracticeGame[] | null {
  const [header, ...rows] = parseCsv(text);
  const cols = header?.map((h) => h.trim().toLowerCase());
  if (!cols || !TEMPLATE_COLUMNS.slice(1).every((c) => cols.includes(c))) return null;

  return rows.map((row, i) => {
    const get = (c: string) => row[cols.indexOf(c)]?.trim() ?? "";
    const parsed = PracticeGame.safeParse({
      playedOn: get("date") || null,
      a: [get("player_a1"), get("player_a2")],
      b: [get("player_b1"), get("player_b2")],
      scoreA: Number(get("score_a")),
      scoreB: Number(get("score_b")),
    });
    if (!parsed.success) {
      throw new PracticeFileError(`Line ${i + 2}: needs four players, whole-number scores, and a YYYY-MM-DD date (or none).`);
    }
    return parsed.data;
  });
}

const Extracted = z.object({
  games: z.array(
    z.object({
      date: z.string().nullable().describe("YYYY-MM-DD if the file shows the date, else null"),
      team_a: z.array(z.string()).describe("The two players on one side"),
      team_b: z.array(z.string()).describe("The two players on the other side"),
      score_a: z.number().int(),
      score_b: z.number().int(),
    }),
  ),
});

async function extractWithAi(content: { text: string } | { inlineData: { mimeType: string; data: string } }, roster: string[]) {
  const { $schema, ...schema } = z.toJSONSchema(Extracted) as Record<string, unknown>;
  const response = await gemini().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          content,
          {
            text:
              "This file records pickleball doubles practice games among teammates. Extract every game that has a final score. " +
              "Skip games without a score. When a name clearly refers to someone on this roster, use the roster spelling: " +
              roster.join(", "),
          },
        ],
      },
    ],
    config: { responseMimeType: "application/json", responseJsonSchema: schema },
  });

  const parsed = Extracted.safeParse(parseJson(response.text));
  if (!parsed.success) throw new PracticeFileError("Couldn't read games from that file. Try the CSV template instead.");

  return parsed.data.games.flatMap((g) => {
    const game = PracticeGame.safeParse({
      playedOn: g.date && /^\d{4}-\d{2}-\d{2}$/.test(g.date) ? g.date : null,
      a: g.team_a,
      b: g.team_b,
      scoreA: g.score_a,
      scoreB: g.score_b,
    });
    return game.success ? [game.data] : [];
  });
}

/**
 * Lines typed names up with the roster: exact match first, then a unique first name, last name,
 * or prefix ("Chelsea" → "Chelsea Convissar"). Names that match no one are kept as typed.
 */
export function matchToRoster(name: string, roster: string[]): { name: string; known: boolean } {
  const q = name.trim().toLowerCase();
  const lower = roster.map((r) => r.toLowerCase());
  const unique = (hits: number[]) => (hits.length === 1 ? hits[0] : -1);
  const at = [
    unique(lower.flatMap((r, i) => (r === q ? [i] : []))),
    unique(lower.flatMap((r, i) => (r.split(/\s+/)[0] === q ? [i] : []))),
    unique(lower.flatMap((r, i) => (r.split(/\s+/).at(-1) === q ? [i] : []))),
    unique(lower.flatMap((r, i) => (r.startsWith(q) ? [i] : []))),
  ].find((i) => i >= 0);
  return at === undefined ? { name: name.trim(), known: false } : { name: roster[at], known: true };
}

/** Saves practice games as one practice session per date. */
export function savePractice(team: string, games: PracticeGame[], fallbackDate: string, fileName: string): number {
  const byDate = Map.groupBy(games, (g) => g.playedOn ?? fallbackDate);
  for (const [playedOn, sessionGames] of byDate) {
    const names = new Set(sessionGames.flatMap((g) => [...g.a, ...g.b]));
    insertMatch({
      kind: "practice",
      playedOn,
      home: team,
      away: team,
      source: `Practice upload: ${fileName}`,
      players: [...names].map((name) => ({ name, team, gender: null })),
      games: sessionGames.map((g) => ({ round: null, a: g.a, b: g.b, scoreA: g.scoreA, scoreB: g.scoreB })),
    });
  }
  return byDate.size;
}

function parseJson(text: string | undefined): unknown {
  try {
    return JSON.parse(text ?? "");
  } catch {
    return null;
  }
}
