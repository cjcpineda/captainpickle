/**
 * Cross Club Pickleball League sync.
 *
 * crossclubpickleball.com is a single-page app; its data comes from a public, read-only JSON API
 * (the same requests a browser makes when you open the Lineups page). We pull:
 *   - our upcoming schedule, which becomes the fixtures table, and
 *   - every completed match involving us or an upcoming opponent, game by game, for scouting.
 * Matches already imported are never fetched again, so routine syncs make only a few requests.
 */
import { getMeta, setMeta } from "./db.ts";
import { leagueToday } from "./deadline.ts";
import {
  deleteManualCopies,
  importedCplIds,
  insertMatch,
  replaceUpcomingFixtures,
  type FixtureInput,
  type MatchInput,
} from "./repo.ts";
import type { Gender } from "./rules.ts";

const API = "https://cplsecureapiproxy.azurewebsites.net/api/CPLSecureApiProxy/v0/api";
const PAUSE_MS = 300; // between match downloads, to go easy on the league's server

/** NJ / PA 4.0. Override with CPL_DIVISION_ID for another division. */
export const DEFAULT_DIVISION_ID = "a1413f3d-5f4b-4ad4-b5cf-c21c7c8b7d66";

type Matchup = {
  matchupId: string;
  scheduledTime: string; // local league time, e.g. 2026-10-29T19:30:00
  homeName: string;
  awayName: string;
  endResult: string | null;
  address: string | null;
};

type MatchupDetail = {
  matchupPlayerStats: { playerId: string; firstName: string; lastName: string; gender: string; teamId: string }[];
  matchup: { homeTeamId: string; awayTeamId: string };
  lineups: {
    lineups: {
      gameNumber: number;
      homePlayerId1: string;
      homePlayerId2: string;
      awayPlayerId1: string;
      awayPlayerId2: string;
      homeScore: number;
      awayScore: number;
    }[];
  };
};

type Region = { location: string; divisions: { divisionId: string; divisionName: string }[] };

export type SyncResult = { division: string; fixtures: number; imported: number };

export async function syncFromCpl(team: string, divisionId = DEFAULT_DIVISION_ID): Promise<SyncResult> {
  const division = await divisionName(divisionId);
  const matchups = await get<Matchup[]>(`/divisions/${divisionId}/matchups`);
  const ours = matchups.filter((m) => m.homeName === team || m.awayName === team);
  const today = leagueToday();

  const upcoming: FixtureInput[] = ours
    .filter((m) => !m.endResult && m.scheduledTime.slice(0, 10) >= today)
    .map((m) => ({
      team,
      opponent: m.homeName === team ? m.awayName : m.homeName,
      playOn: m.scheduledTime.slice(0, 10),
      startTime: m.scheduledTime.slice(11, 16),
      isHome: m.homeName === team,
      division,
      location: m.address,
    }));
  replaceUpcomingFixtures(team, today, upcoming);

  const scouted = new Set([team, ...upcoming.map((f) => f.opponent)]);
  const known = importedCplIds();
  const toImport = matchups.filter(
    (m) => m.endResult && !known.has(m.matchupId) && (scouted.has(m.homeName) || scouted.has(m.awayName)),
  );

  for (const m of toImport) {
    const detail = await get<MatchupDetail>(`/divisions/${divisionId}/matchups/${m.matchupId}`);
    const match = toMatch(m, detail);
    deleteManualCopies(match.home, match.away, match.playedOn);
    insertMatch(match);
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  setMeta("cpl_synced_at", new Date().toISOString());
  return { division, fixtures: upcoming.length, imported: toImport.length };
}

export const lastSyncedAt = () => getMeta("cpl_synced_at");

function toMatch(m: Matchup, detail: MatchupDetail): MatchInput {
  const teamName = (teamId: string) => (teamId === detail.matchup.homeTeamId ? m.homeName : m.awayName);
  const players = new Map(
    detail.matchupPlayerStats.map((p) => [
      p.playerId,
      { name: `${p.firstName} ${p.lastName}`.trim(), team: teamName(p.teamId), gender: toGender(p.gender) },
    ]),
  );
  const name = (id: string) => players.get(id)!.name;
  // Forfeited games come back scored 0-1 with no players attached; they say nothing about anyone.
  const played = (g: MatchupDetail["lineups"]["lineups"][number]) =>
    [g.homePlayerId1, g.homePlayerId2, g.awayPlayerId1, g.awayPlayerId2].every((id) => players.has(id));

  return {
    kind: "league",
    playedOn: m.scheduledTime.slice(0, 10),
    home: m.homeName,
    away: m.awayName,
    source: "CPL",
    cplId: m.matchupId,
    players: [...players.values()],
    games: detail.lineups.lineups
      .filter(played)
      .sort((a, b) => a.gameNumber - b.gameNumber)
      .map((g) => ({
        round: Math.floor(g.gameNumber / 4) + 1,
        a: [name(g.homePlayerId1), name(g.homePlayerId2)],
        b: [name(g.awayPlayerId1), name(g.awayPlayerId2)],
        scoreA: g.homeScore,
        scoreB: g.awayScore,
      })),
  };
}

async function divisionName(divisionId: string): Promise<string> {
  const regions = await get<Region[]>("/regions");
  for (const region of regions) {
    const division = region.divisions.find((d) => d.divisionId === divisionId);
    if (division) return `${region.location} ${division.divisionName}`;
  }
  throw new Error(`CPL division ${divisionId} not found.`);
}

function toGender(value: string): Gender | null {
  return value === "Female" ? "F" : value === "Male" ? "M" : null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CPL request failed (${res.status}): ${path}`);
  return resolveReferences(await res.json()) as T;
}

/**
 * The API serializes with .NET reference preservation: objects carry "$id", repeats become
 * { "$ref": id }, and arrays are wrapped as { "$values": [...] }. This turns it back into plain JSON.
 */
export function resolveReferences(value: unknown, seen = new Map<string, unknown>()): unknown {
  if (Array.isArray(value)) return value.map((v) => resolveReferences(v, seen));
  if (!value || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  if (typeof obj.$ref === "string") return seen.get(obj.$ref);
  if (Array.isArray(obj.$values)) {
    const list: unknown[] = [];
    if (typeof obj.$id === "string") seen.set(obj.$id, list);
    for (const v of obj.$values) list.push(resolveReferences(v, seen));
    return list;
  }

  const out: Record<string, unknown> = {};
  if (typeof obj.$id === "string") seen.set(obj.$id, out);
  for (const [k, v] of Object.entries(obj)) if (k !== "$id") out[k] = resolveReferences(v, seen);
  return out;
}
