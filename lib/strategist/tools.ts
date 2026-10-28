/** The league database, as tools the strategist can call. Every number it quotes comes from here. */
import type { FunctionDeclaration } from "@google/genai";
import { z } from "zod";
import type { Captain } from "../auth.ts";
import { leagueToday, lineupDeadline } from "../deadline.ts";
import { pairRecords, scoutingReport } from "../scouting.ts";
import {
  findPlayer,
  findTeam,
  listTeams,
  matchGames,
  playerGames,
  results,
  teamPlayers,
  upcomingFixtures,
} from "../repo.ts";

type Tool<S extends z.ZodType> = {
  description: string;
  status: string;
  input: S;
  run: (input: z.infer<S>, captain: Captain) => unknown;
};

const tool = <S extends z.ZodType>(t: Tool<S>) => t;

const TOOLS = {
  get_schedule: tool({
    description:
      "Our team's upcoming matches (date, start time, home/away, division, location, lineup deadline) " +
      "and past league results (games won-lost per match).",
    status: "Checking the schedule",
    input: z.object({}),
    run: (_, captain) => ({
      team: captain.teamName,
      upcoming: upcomingFixtures(captain.teamId, leagueToday()).map((f) => ({
        ...f,
        lineupDeadline: lineupDeadline(f.playOn, f.isHome),
      })),
      results: results(captain.teamId),
    }),
  }),

  get_roster: tool({
    description: "Players on a team with gender (F/M). Defaults to our team. Also lists every team in the league.",
    status: "Pulling the roster",
    input: z.object({ team: z.string().optional().describe("Team name; omit for our team") }),
    run: ({ team }, captain) => {
      const found = team ? findTeam(team) : { id: captain.teamId, name: captain.teamName };
      if (!found) return { error: `No team matching "${team}".`, teams: listTeams().map((t) => t.name) };
      return { team: found.name, players: teamPlayers(found.id).map(({ name, gender }) => ({ name, gender })) };
    },
  }),

  get_match_games: tool({
    description:
      "Game-by-game lineups and scores from our league matches, newest first, optionally only against one opponent. " +
      "Shows who each team paired together in every round.",
    status: "Reading match sheets",
    input: z.object({ opponent: z.string().optional() }),
    run: ({ opponent }, captain) => {
      const matches = results(captain.teamId).filter(
        (r) => !opponent || r.opponent.toLowerCase().includes(opponent.trim().toLowerCase()),
      );
      return matches.map((m) => ({ ...m, games: matchGames(m.matchId, captain.teamId) }));
    },
  }),

  get_scouting_report: tool({
    description:
      "Scouting report on a team: roster with each player's record and point differential, every pair they've used " +
      "(most frequent first, with format and record), and their strongest players by win rate.",
    status: "Scouting the opponent",
    input: z.object({ team: z.string() }),
    run: ({ team }) => {
      const found = findTeam(team);
      if (!found) return { error: `No team matching "${team}".`, teams: listTeams().map((t) => t.name) };
      return scoutingReport(found.id);
    },
  }),

  get_pair_records: tool({
    description:
      "Every pair our team has used, with league and practice results reported separately " +
      "(games, wins, point differential). Use it to find our best pairs and how they've done together.",
    status: "Comparing our pairs",
    input: z.object({}),
    run: (_, captain) => pairRecords(captain.teamId),
  }),

  get_player_games: tool({
    description: "Every game on file for one player (league and practice): date, partner, opponents, score, result.",
    status: "Looking up player history",
    input: z.object({ player: z.string().describe("Full or partial name") }),
    run: ({ player }) => {
      const matches = findPlayer(player);
      if (matches.length !== 1) {
        return { error: matches.length ? `"${player}" is ambiguous` : `No player matching "${player}"`, candidates: matches.map((p) => p.name) };
      }
      const [p] = matches;
      const games = playerGames(p.id);
      return { player: p.name, team: p.teamName, gender: p.gender, wins: games.filter((g) => g.won).length, games };
    },
  }),
};

type ToolName = keyof typeof TOOLS;

export const toolDefinitions: FunctionDeclaration[] = Object.entries(TOOLS).map(([name, t]) => {
  const { $schema, ...schema } = z.toJSONSchema(t.input) as Record<string, unknown>;
  return { name, description: t.description, parametersJsonSchema: schema };
});

export function toolStatus(name: string): string {
  return TOOLS[name as ToolName]?.status ?? "Working";
}

/** Validates the model's arguments against the tool's schema before running it. */
export function runTool(name: string, input: unknown, captain: Captain): { output: unknown } | { error: string } {
  const t = TOOLS[name as ToolName] as Tool<z.ZodType> | undefined;
  if (!t) return { error: `Unknown tool ${name}` };
  const parsed = t.input.safeParse(input ?? {});
  if (!parsed.success) return { error: `Invalid input: ${parsed.error.message}` };
  try {
    return { output: t.run(parsed.data, captain) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
