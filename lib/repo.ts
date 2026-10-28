import { db, transaction } from "./db.ts";
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

export function upsertTeam(name: string): number {
  const conn = db();
  conn.prepare("INSERT INTO teams (name) VALUES (?) ON CONFLICT (name) DO NOTHING").run(name.trim());
  return (conn.prepare("SELECT id FROM teams WHERE name = ?").get(name.trim()) as { id: number }).id;
}

export function upsertPlayer(name: string, teamId: number, gender: Gender | null): number {
  const conn = db();
  conn
    .prepare(
      `INSERT INTO players (name, team_id, gender) VALUES (?, ?, ?)
       ON CONFLICT (name, team_id) DO UPDATE SET gender = coalesce(excluded.gender, players.gender)`,
    )
    .run(name.trim(), teamId, gender);
  return (conn.prepare("SELECT id FROM players WHERE name = ? AND team_id = ?").get(name.trim(), teamId) as { id: number }).id;
}

export function insertMatch(input: MatchInput): number {
  return transaction(() => {
    const conn = db();
    const homeId = upsertTeam(input.home);
    const awayId = upsertTeam(input.away);
    const ids = new Map(input.players.map((p) => [p.name, upsertPlayer(p.name, upsertTeam(p.team), p.gender)]));
    const id = (name: string) => ids.get(name) ?? upsertPlayer(name, homeId, null);

    const { lastInsertRowid } = conn
      .prepare("INSERT INTO matches (kind, played_on, home_id, away_id, source, cpl_id) VALUES (?, ?, ?, ?, ?, ?)")
      .run(input.kind, input.playedOn, homeId, awayId, input.source, input.cplId ?? null);
    const insertGame = conn.prepare(
      "INSERT INTO games (match_id, round, a1, a2, b1, b2, score_a, score_b) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const g of input.games) {
      insertGame.run(lastInsertRowid, g.round, id(g.a[0]), id(g.a[1]), id(g.b[0]), id(g.b[1]), g.scoreA, g.scoreB);
    }
    return Number(lastInsertRowid);
  });
}

export function listTeams(): Team[] {
  return db().prepare("SELECT id, name FROM teams ORDER BY name").all() as Team[];
}

/** Case-insensitive team lookup that tolerates partial names ("bounce" → "Bounce Philly"). */
export function findTeam(query: string): Team | undefined {
  const q = query.trim().toLowerCase();
  const teams = listTeams();
  return teams.find((t) => t.name.toLowerCase() === q) ?? teams.find((t) => t.name.toLowerCase().includes(q));
}

export function teamPlayers(teamId: number): Player[] {
  return db()
    .prepare(
      `SELECT p.id, p.name, p.gender, p.team_id AS teamId, t.name AS teamName
       FROM players p JOIN teams t ON t.id = p.team_id
       WHERE p.team_id = ? ORDER BY p.name`,
    )
    .all(teamId) as Player[];
}

export function upcomingFixtures(teamId: number, fromDate: string): Fixture[] {
  const rows = db()
    .prepare(
      `SELECT f.id, t.name AS opponent, f.opponent_id AS opponentId, f.play_on AS playOn, f.start_time AS startTime,
              f.is_home AS isHome, f.division, f.location
       FROM fixtures f JOIN teams t ON t.id = f.opponent_id
       WHERE f.team_id = ? AND f.play_on >= ? ORDER BY f.play_on`,
    )
    .all(teamId, fromDate) as (Omit<Fixture, "isHome"> & { isHome: number })[];
  return rows.map((r) => ({ ...r, isHome: r.isHome === 1 }));
}

export function importedCplIds(): Set<string> {
  const rows = db().prepare("SELECT cpl_id AS id FROM matches WHERE cpl_id IS NOT NULL").all() as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

/**
 * Drops a hand-entered copy of a match CPL now provides (same two teams, within two days),
 * so it isn't counted twice.
 */
export function deleteManualCopies(home: string, away: string, playedOn: string) {
  db()
    .prepare(
      `DELETE FROM matches WHERE cpl_id IS NULL AND kind = 'league'
         AND abs(julianday(played_on) - julianday(?)) <= 2
         AND home_id IN (SELECT id FROM teams WHERE name IN (?, ?))
         AND away_id IN (SELECT id FROM teams WHERE name IN (?, ?))`,
    )
    .run(playedOn, home, away, home, away);
}

/** Replaces a team's upcoming schedule with the given fixtures, all at once. */
export function replaceUpcomingFixtures(team: string, fromDate: string, fixtures: FixtureInput[]) {
  transaction(() => {
    db().prepare("DELETE FROM fixtures WHERE team_id = ? AND play_on >= ?").run(upsertTeam(team), fromDate);
    fixtures.forEach(upsertFixture);
  });
}

/** Inserts or refreshes a scheduled match. */
export function upsertFixture(f: FixtureInput) {
  db()
    .prepare(
      `INSERT INTO fixtures (team_id, opponent_id, play_on, start_time, is_home, division, location)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (team_id, opponent_id, play_on) DO UPDATE SET
         start_time = excluded.start_time, is_home = excluded.is_home,
         division = excluded.division, location = excluded.location`,
    )
    .run(upsertTeam(f.team), upsertTeam(f.opponent), f.playOn, f.startTime, f.isHome ? 1 : 0, f.division, f.location);
}

/** League results from our side of the net: games won and lost per match. */
export function results(teamId: number): Result[] {
  const rows = db()
    .prepare(
      `SELECT m.id AS matchId, m.played_on AS playedOn,
              CASE WHEN m.home_id = :team THEN away.name ELSE home.name END AS opponent,
              m.home_id = :team AS isHome,
              sum(CASE WHEN (g.score_a > g.score_b) = (m.home_id = :team) THEN 1 ELSE 0 END) AS gamesWon,
              sum(CASE WHEN (g.score_a > g.score_b) = (m.home_id = :team) THEN 0 ELSE 1 END) AS gamesLost
       FROM matches m
       JOIN teams home ON home.id = m.home_id
       JOIN teams away ON away.id = m.away_id
       JOIN games g ON g.match_id = m.id
       WHERE m.kind = 'league' AND :team IN (m.home_id, m.away_id)
       GROUP BY m.id ORDER BY m.played_on DESC`,
    )
    .all({ team: teamId }) as (Omit<Result, "isHome"> & { isHome: number })[];
  return rows.map((r) => ({ ...r, isHome: r.isHome === 1 }));
}

/** Every game of a match, with player names, oriented so `home` is the given team when it played. */
export function matchGames(matchId: number, teamId?: number): GameDetail[] {
  const rows = db()
    .prepare(
      `SELECT g.round, pa1.name AS a1, pa2.name AS a2, pb1.name AS b1, pb2.name AS b2,
              g.score_a AS scoreA, g.score_b AS scoreB, m.away_id AS awayId
       FROM games g JOIN matches m ON m.id = g.match_id
       JOIN players pa1 ON pa1.id = g.a1 JOIN players pa2 ON pa2.id = g.a2
       JOIN players pb1 ON pb1.id = g.b1 JOIN players pb2 ON pb2.id = g.b2
       WHERE g.match_id = ? ORDER BY g.round, g.id`,
    )
    .all(matchId) as { round: number | null; a1: string; a2: string; b1: string; b2: string; scoreA: number; scoreB: number; awayId: number }[];

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
export function playerGames(playerId: number): PlayerGame[] {
  const rows = db()
    .prepare(
      `SELECT m.played_on AS playedOn, m.kind, g.round, g.score_a AS scoreA, g.score_b AS scoreB,
              g.a1, g.a2, (SELECT name FROM players WHERE id = :p) AS me, pa1.name AS a1Name, pa2.name AS a2Name, pb1.name AS b1Name, pb2.name AS b2Name
       FROM games g JOIN matches m ON m.id = g.match_id
       JOIN players pa1 ON pa1.id = g.a1 JOIN players pa2 ON pa2.id = g.a2
       JOIN players pb1 ON pb1.id = g.b1 JOIN players pb2 ON pb2.id = g.b2
       WHERE :p IN (g.a1, g.a2, g.b1, g.b2) ORDER BY m.played_on, g.round`,
    )
    .all({ p: playerId }) as {
    playedOn: string; kind: "league" | "practice"; round: number | null; scoreA: number; scoreB: number;
    a1: number; a2: number; me: string; a1Name: string; a2Name: string; b1Name: string; b2Name: string;
  }[];

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

export function findPlayer(query: string): Player[] {
  const q = query.trim().toLowerCase();
  const all = db()
    .prepare(
      `SELECT p.id, p.name, p.gender, p.team_id AS teamId, t.name AS teamName
       FROM players p JOIN teams t ON t.id = p.team_id ORDER BY p.name`,
    )
    .all() as Player[];
  return [
    all.filter((p) => p.name.toLowerCase() === q),
    all.filter((p) => p.name.toLowerCase().split(/\s+/).includes(q)),
    all.filter((p) => p.name.toLowerCase().includes(q)),
  ].find((m) => m.length > 0) ?? [];
}
