import { all, batch, get, run, stmt } from "./db.ts";
import type { Gender } from "./rules.ts";

export type Team = { id: number; name: string };

export type Player = { id: number; name: string; gender: Gender | null; teamId: number; teamName: string };

export type Fixture = {
  id: number;
  opponent: string;
  opponentId: number;
  playOn: string;
  startTime: string;
  isHome: boolean;
  division: string | null;
  location: string | null;
};

export type FixtureInput = Omit<Fixture, "id" | "opponentId"> & { team: string };

export type Result = {
  matchId: number;
  playedOn: string;
  opponent: string;
  isHome: boolean;
  gamesWon: number;
  gamesLost: number;
};

export type GameDetail = {
  round: number | null;
  home: [string, string];
  away: [string, string];
  homeScore: number;
  awayScore: number;
};

export type MatchInput = {
  kind: "league" | "practice";
  playedOn: string;
  home: string;
  away: string;
  source: string;
  cplId?: string;
  players: { name: string; team: string; gender: Gender | null }[];
  games: { round: number | null; a: [string, string]; b: [string, string]; scoreA: number; scoreB: number }[];
};

export async function upsertTeam(name: string): Promise<number> {
  const row = await get<{ id: number }>(
    "INSERT INTO teams (name) VALUES (?) ON CONFLICT (name) DO UPDATE SET name = teams.name RETURNING id",
    name.trim(),
  );
  return row!.id;
}

export async function upsertPlayer(name: string, teamId: number, gender: Gender | null): Promise<number> {
  const row = await get<{ id: number }>(
    `INSERT INTO players (name, team_id, gender) VALUES (?, ?, ?)
     ON CONFLICT (name, team_id) DO UPDATE SET gender = coalesce(excluded.gender, players.gender)
     RETURNING id`,
    name.trim(),
    teamId,
    gender,
  );
  return row!.id;
}

export async function insertMatch(input: MatchInput): Promise<number> {
  const homeId = await upsertTeam(input.home);
  const awayId = await upsertTeam(input.away);

  // Resolve every player to an id first; names not in the player list default to the home team.
  const ids = new Map<string, number>();
  for (const p of input.players) ids.set(p.name, await upsertPlayer(p.name, await upsertTeam(p.team), p.gender));
  for (const name of input.games.flatMap((g) => [...g.a, ...g.b])) {
    if (!ids.has(name)) ids.set(name, await upsertPlayer(name, homeId, null));
  }
  const id = (name: string) => ids.get(name)!;

  // The match and its games are written together, so a failure never leaves a match without games.
  const [inserted] = await batch([
    stmt(
    "INSERT INTO matches (kind, played_on, home_id, away_id, source, cpl_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
      input.kind, input.playedOn, homeId, awayId, input.source, input.cplId ?? null,
    ),
    ...input.games.map((g) =>
      stmt(
        `INSERT INTO games (match_id, round, a1, a2, b1, b2, score_a, score_b)
         VALUES ((SELECT max(id) FROM matches), ?, ?, ?, ?, ?, ?, ?)`,
        g.round, id(g.a[0]), id(g.a[1]), id(g.b[0]), id(g.b[1]), g.scoreA, g.scoreB,
      ),
    ),
  ]);
  return (inserted.results[0] as { id: number }).id;
}

export function listTeams(): Promise<Team[]> {
  return all<Team>("SELECT id, name FROM teams ORDER BY name");
}

/** Case-insensitive team lookup that tolerates partial names ("bounce" → "Bounce Philly"). */
export async function findTeam(query: string): Promise<Team | undefined> {
  const q = query.trim().toLowerCase();
  const teams = await listTeams();
  return teams.find((t) => t.name.toLowerCase() === q) ?? teams.find((t) => t.name.toLowerCase().includes(q));
}

export async function teamPlayers(teamId: number): Promise<Player[]> {
  return all<Player>(
    `SELECT p.id, p.name, p.gender, p.team_id AS teamId, t.name AS teamName
       FROM players p JOIN teams t ON t.id = p.team_id
       WHERE p.team_id = ? ORDER BY p.name`,
    teamId,
  );
}

export async function upcomingFixtures(teamId: number, fromDate: string): Promise<Fixture[]> {
  const rows = await all<Omit<Fixture, "isHome"> & { isHome: number }>(
    `SELECT f.id, t.name AS opponent, f.opponent_id AS opponentId, f.play_on AS playOn, f.start_time AS startTime,
              f.is_home AS isHome, f.division, f.location
       FROM fixtures f JOIN teams t ON t.id = f.opponent_id
       WHERE f.team_id = ? AND f.play_on >= ? ORDER BY f.play_on`,
    teamId, fromDate,
  );
  return rows.map((r) => ({ ...r, isHome: r.isHome === 1 }));
}

export async function importedCplIds(): Promise<Set<string>> {
  const rows = await all<{ id: string }>("SELECT cpl_id AS id FROM matches WHERE cpl_id IS NOT NULL");
  return new Set(rows.map((r) => r.id));
}

/**
 * Drops a hand-entered copy of a match CPL now provides (same two teams, within two days),
 * so it isn't counted twice.
 */
export async function deleteManualCopies(home: string, away: string, playedOn: string) {
  await run(
    `DELETE FROM matches WHERE cpl_id IS NULL AND kind = 'league'
     AND abs(julianday(played_on) - julianday(?)) <= 2
     AND home_id IN (SELECT id FROM teams WHERE name IN (?, ?))
     AND away_id IN (SELECT id FROM teams WHERE name IN (?, ?))`,
    playedOn, home, away, home, away,
  );
}

/** Replaces a team's upcoming schedule with the given fixtures, all at once. */
export async function replaceUpcomingFixtures(team: string, fromDate: string, fixtures: FixtureInput[]) {
  const teamIds = new Map<string, number>();
  for (const name of [team, ...fixtures.flatMap((f) => [f.team, f.opponent])]) {
    if (!teamIds.has(name)) teamIds.set(name, await upsertTeam(name));
  }

  await batch([
    stmt("DELETE FROM fixtures WHERE team_id = ? AND play_on >= ?", teamIds.get(team)!, fromDate),
    ...fixtures.map((f) =>
      stmt(
        `INSERT INTO fixtures (team_id, opponent_id, play_on, start_time, is_home, division, location)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (team_id, opponent_id, play_on) DO UPDATE SET
           start_time = excluded.start_time, is_home = excluded.is_home,
           division = excluded.division, location = excluded.location`,
        teamIds.get(f.team)!, teamIds.get(f.opponent)!, f.playOn, f.startTime, f.isHome ? 1 : 0, f.division, f.location,
      ),
    ),
  ]);
}

/** League results from our side of the net: games won and lost per match. */
export async function results(teamId: number): Promise<Result[]> {
  const rows = await all<Omit<Result, "isHome"> & { isHome: number }>(
    `SELECT m.id AS matchId, m.played_on AS playedOn,
              CASE WHEN m.home_id = ?1 THEN away.name ELSE home.name END AS opponent,
              m.home_id = ?1 AS isHome,
              sum(CASE WHEN (g.score_a > g.score_b) = (m.home_id = ?1) THEN 1 ELSE 0 END) AS gamesWon,
              sum(CASE WHEN (g.score_a > g.score_b) = (m.home_id = ?1) THEN 0 ELSE 1 END) AS gamesLost
       FROM matches m
       JOIN teams home ON home.id = m.home_id
       JOIN teams away ON away.id = m.away_id
       JOIN games g ON g.match_id = m.id
       WHERE m.kind = 'league' AND ?1 IN (m.home_id, m.away_id)
       GROUP BY m.id ORDER BY m.played_on DESC`,
    teamId,
  );
  return rows.map((r) => ({ ...r, isHome: r.isHome === 1 }));
}

/** Every game of a match, with player names, oriented so `home` is the given team when it played. */
export async function matchGames(matchId: number, teamId?: number): Promise<GameDetail[]> {
  const rows = await all<{
    round: number | null; a1: string; a2: string; b1: string; b2: string; scoreA: number; scoreB: number; awayId: number;
  }>(
    `SELECT g.round, pa1.name AS a1, pa2.name AS a2, pb1.name AS b1, pb2.name AS b2,
              g.score_a AS scoreA, g.score_b AS scoreB, m.away_id AS awayId
       FROM games g JOIN matches m ON m.id = g.match_id
       JOIN players pa1 ON pa1.id = g.a1 JOIN players pa2 ON pa2.id = g.a2
       JOIN players pb1 ON pb1.id = g.b1 JOIN players pb2 ON pb2.id = g.b2
       WHERE g.match_id = ? ORDER BY g.round, g.id`, matchId,
  );

  return rows.map((r) => {
    const flip = teamId !== undefined && r.awayId === teamId;
    const a: [string, string] = [r.a1, r.a2];
    const b: [string, string] = [r.b1, r.b2];
    return flip
      ? { round: r.round, home: b, away: a, homeScore: r.scoreB, awayScore: r.scoreA }
      : { round: r.round, home: a, away: b, homeScore: r.scoreA, awayScore: r.scoreB };
  });
}

export type PlayerGame = {
  playedOn: string;
  kind: "league" | "practice";
  round: number | null;
  partner: string;
  opponents: [string, string];
  score: string;
  won: boolean;
};

/** Every game a player has on file, from their side of the net. */
export async function playerGames(playerId: number): Promise<PlayerGame[]> {
  const rows = await all<{
    playedOn: string; kind: "league" | "practice"; round: number | null; scoreA: number; scoreB: number;
    a1: number; a2: number; me: string; a1Name: string; a2Name: string; b1Name: string; b2Name: string;
  }>(
    `SELECT m.played_on AS playedOn, m.kind, g.round, g.score_a AS scoreA, g.score_b AS scoreB,
              g.a1, g.a2, (SELECT name FROM players WHERE id = ?1) AS me, pa1.name AS a1Name, pa2.name AS a2Name, pb1.name AS b1Name, pb2.name AS b2Name
       FROM games g JOIN matches m ON m.id = g.match_id
       JOIN players pa1 ON pa1.id = g.a1 JOIN players pa2 ON pa2.id = g.a2
       JOIN players pb1 ON pb1.id = g.b1 JOIN players pb2 ON pb2.id = g.b2
       WHERE ?1 IN (g.a1, g.a2, g.b1, g.b2) ORDER BY m.played_on, g.round`, playerId,
  );

  return rows.map((r) => {
    const onA = r.a1 === playerId || r.a2 === playerId;
    const sideA = [r.a1Name, r.a2Name];
    const sideB: [string, string] = [r.b1Name, r.b2Name];
    const [mine, theirs] = onA ? [sideA, sideB] : [sideB, sideA as [string, string]];
    const [pointsFor, pointsAgainst] = onA ? [r.scoreA, r.scoreB] : [r.scoreB, r.scoreA];
    return {
      playedOn: r.playedOn,
      kind: r.kind,
      round: r.round,
      partner: mine.find((n) => n !== r.me) ?? mine[1],
      opponents: theirs,
      score: `${pointsFor}-${pointsAgainst}`,
      won: pointsFor > pointsAgainst,
    };
  });
}

export async function findPlayer(query: string): Promise<Player[]> {
  const q = query.trim().toLowerCase();
  const players = await all<Player>(
    `SELECT p.id, p.name, p.gender, p.team_id AS teamId, t.name AS teamName
       FROM players p JOIN teams t ON t.id = p.team_id ORDER BY p.name`,
  );
  return [
    players.filter((p) => p.name.toLowerCase() === q),
    players.filter((p) => p.name.toLowerCase().split(/\s+/).includes(q)),
    players.filter((p) => p.name.toLowerCase().includes(q)),
  ].find((m) => m.length > 0) ?? [];
}

export type PracticeSession = { matchId: number; playedOn: string; source: string; games: number };

export async function practiceSessions(teamId: number): Promise<PracticeSession[]> {
  return all<PracticeSession>(
    `SELECT m.id AS matchId, m.played_on AS playedOn, m.source, count(g.id) AS games
       FROM matches m JOIN games g ON g.match_id = m.id
       WHERE m.kind = 'practice' AND m.home_id = ?
       GROUP BY m.id ORDER BY m.played_on DESC, m.id DESC`,
    teamId,
  );
}

export async function deletePracticeSession(teamId: number, matchId: number) {
  await run(
    "DELETE FROM matches WHERE id = ? AND kind = 'practice' AND home_id = ?",
    matchId, teamId,
  );
}
