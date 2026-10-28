"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth.ts";
import { describeAiError } from "@/lib/gemini.ts";
import {
  matchToRoster,
  MAX_UPLOAD_BYTES,
  PracticeFileError,
  PracticeGame,
  readPracticeFile,
  savePractice,
} from "@/lib/practice.ts";
import { deletePracticeSession, teamPlayers } from "@/lib/repo.ts";

export type Preview = { fileName: string; games: PracticeGame[]; newPlayers: string[] };

/** Reads an uploaded file and returns its games, with names matched to the roster, for the captain to check. */
export async function previewPractice(form: FormData): Promise<Preview | { error: string }> {
  const captain = await requireCaptain();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "That file is over 10 MB." };

  const roster = teamPlayers(captain.teamId).map((p) => p.name);
  let games: PracticeGame[];
  try {
    games = await readPracticeFile({ name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) }, roster);
  } catch (err) {
    return { error: err instanceof PracticeFileError ? err.message : describeAiError(err) };
  }
  if (games.length === 0) return { error: "No scored games found in that file." };

  const newPlayers = new Set<string>();
  const resolve = (name: string) => {
    const match = matchToRoster(name, roster);
    if (!match.known) newPlayers.add(match.name);
    return match.name;
  };
  const resolved = games.map((g) => ({
    ...g,
    a: [resolve(g.a[0]), resolve(g.a[1])] as [string, string],
    b: [resolve(g.b[0]), resolve(g.b[1])] as [string, string],
  }));
  return { fileName: file.name, games: resolved, newPlayers: [...newPlayers] };
}

const SaveInput = z.object({
  fileName: z.string().min(1).max(200),
  fallbackDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  games: z.array(PracticeGame).min(1).max(2000),
});

export async function savePracticeGames(input: z.infer<typeof SaveInput>): Promise<{ error: string } | { sessions: number }> {
  const captain = await requireCaptain();
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return { error: "Those games didn't look right. Try uploading again." };
  const { fileName, fallbackDate, games } = parsed.data;
  const sessions = savePractice(captain.teamName, games, fallbackDate, fileName);
  revalidatePath("/practice");
  return { sessions };
}

export async function deletePractice(matchId: number) {
  const captain = await requireCaptain();
  deletePracticeSession(captain.teamId, matchId);
  revalidatePath("/practice");
}
