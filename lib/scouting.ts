/** Scouting report for an opponent, built from every game of theirs we have on file. */
import { all, get } from "./db.ts";
import type { Gender } from "./rules.ts";

export type Format = "mixed" | "womens" | "mens";

export type ScoutedPlayer = {
  name: string;
  gender: Gender | null;
  games: number;
  wins: number;
  pointDiff: number;
};

export type ScoutedPair = {
  players: [string, string];
  format: Format | null;
  games: number;
  wins: number;
  pointDiff: number;
};

export type ScoutingReport = {
  team: string;
  gamesOnFile: number;
  roster: ScoutedPlayer[];
  likelyPairs: ScoutedPair[];
  strongest: ScoutedPlayer[];
};

const MIN_GAMES_TO_RANK = 2;
const STRONGEST_COUNT = 4;

/** Each game twice, once from each side, so every row reads "this pair, for/against". */
const SIDES = `
  SELECT g.a1 AS p1, g.a2 AS p2, g.score_a AS pf, g.score_b AS pa FROM games g
  UNION ALL
  SELECT g.b1, g.b2, g.score_b, g.score_a FROM games g`;

export async function scoutingReport(teamId: number): Promise<ScoutingReport> {
  const { name: team } = (await get<{ name: string }>("SELECT name FROM teams WHERE id = ?", teamId))!;

  const roster = await all<ScoutedPlayer>(
    `WITH sides AS (${SIDES}),
       appearances AS (SELECT p1 AS id, pf, pa FROM sides UNION ALL SELECT p2, pf, pa FROM sides)
       SELECT p.name, p.gender, count(a.id) AS games,
              coalesce(sum(a.pf > a.pa), 0) AS wins, coalesce(sum(a.pf - a.pa), 0) AS pointDiff
       FROM players p LEFT JOIN appearances a ON a.id = p.id
       WHERE p.team_id = ?
       GROUP BY p.id ORDER BY games DESC, p.name`,
    teamId,
  );

  const pairs = await all<{ n1: string; n2: string; g1: Gender | null; g2: Gender | null; games: number; wins: number; pointDiff: number }>(
    `WITH sides AS (${SIDES})
       SELECT x.name AS n1, y.name AS n2, x.gender AS g1, y.gender AS g2,
              count(*) AS games, sum(s.pf > s.pa) AS wins, sum(s.pf - s.pa) AS pointDiff
       FROM sides s
       JOIN players x ON x.id = min(s.p1, s.p2)
       JOIN players y ON y.id = max(s.p1, s.p2)
       WHERE x.team_id = ?
       GROUP BY x.id, y.id
       ORDER BY games DESC, wins DESC, pointDiff DESC`,
    teamId,
  );

  const { gamesOnFile } = (await get<{ gamesOnFile: number }>(
    `SELECT count(*) AS gamesOnFile FROM games g
       WHERE EXISTS (SELECT 1 FROM players p WHERE p.team_id = ? AND p.id IN (g.a1, g.a2, g.b1, g.b2))`,
    teamId,
  ))!;

  // Players with enough games to trust their win rate come first; anyone else who has played fills any open spots.
  const strongest = roster
    .filter((p) => p.games > 0)
    .sort(
      (a, b) =>
        Number(b.games >= MIN_GAMES_TO_RANK) - Number(a.games >= MIN_GAMES_TO_RANK) ||
        b.wins / b.games - a.wins / a.games ||
        b.pointDiff / b.games - a.pointDiff / a.games,
    )
    .slice(0, STRONGEST_COUNT);

  return {
    team,
    gamesOnFile,
    roster,
    likelyPairs: pairs.map(({ n1, n2, g1, g2, ...stats }) => ({ players: [n1, n2], format: formatOf(g1, g2), ...stats })),
    strongest,
  };
}

function formatOf(a: Gender | null, b: Gender | null): Format | null {
  if (!a || !b) return null;
  return a !== b ? "mixed" : a === "F" ? "womens" : "mens";
}

export type WinLoss = { games: number; wins: number; pointDiff: number };

export type PairRecord = {
  players: [string, string];
  format: Format | null;
  league: WinLoss;
  practice: WinLoss;
};

/** Every pair a team has used, with league and practice results kept apart. */
export async function pairRecords(teamId: number): Promise<PairRecord[]> {
  const rows = await all<{ n1: string; n2: string; g1: Gender | null; g2: Gender | null; lg: number; lw: number; ld: number; pg: number; pw: number; pd: number }>(
    `WITH sides AS (
         SELECT m.kind, g.a1 AS p1, g.a2 AS p2, g.score_a AS pf, g.score_b AS pa FROM games g JOIN matches m ON m.id = g.match_id
         UNION ALL
         SELECT m.kind, g.b1, g.b2, g.score_b, g.score_a FROM games g JOIN matches m ON m.id = g.match_id)
       SELECT x.name AS n1, y.name AS n2, x.gender AS g1, y.gender AS g2,
              sum(s.kind = 'league') AS lg, sum(s.kind = 'league' AND s.pf > s.pa) AS lw,
              sum(CASE WHEN s.kind = 'league' THEN s.pf - s.pa ELSE 0 END) AS ld,
              sum(s.kind = 'practice') AS pg, sum(s.kind = 'practice' AND s.pf > s.pa) AS pw,
              sum(CASE WHEN s.kind = 'practice' THEN s.pf - s.pa ELSE 0 END) AS pd
       FROM sides s
       JOIN players x ON x.id = min(s.p1, s.p2)
       JOIN players y ON y.id = max(s.p1, s.p2)
       WHERE x.team_id = ? AND y.team_id = x.team_id
       GROUP BY x.id, y.id`,
    teamId,
  );

  return rows.map((r) => ({
    players: [r.n1, r.n2],
    format: formatOf(r.g1, r.g2),
    league: { games: r.lg, wins: r.lw, pointDiff: r.ld },
    practice: { games: r.pg, wins: r.pw, pointDiff: r.pd },
  }));
}

export type PlayerRecord = { name: string; gender: Gender | null; games: number; wins: number };

/** Each player on a team with their win–loss across games of one kind (league or practice). Players with no games are left out. */
export async function playerRecords(teamId: number, kind: "league" | "practice"): Promise<PlayerRecord[]> {
  return all<PlayerRecord>(
    `WITH sides AS (
         SELECT g.a1 AS p1, g.a2 AS p2, g.score_a > g.score_b AS won FROM games g JOIN matches m ON m.id = g.match_id WHERE m.kind = ?2
         UNION ALL
         SELECT g.b1, g.b2, g.score_b > g.score_a FROM games g JOIN matches m ON m.id = g.match_id WHERE m.kind = ?2),
       appearances AS (SELECT p1 AS id, won FROM sides UNION ALL SELECT p2, won FROM sides)
       SELECT p.name, p.gender, count(*) AS games, sum(a.won) AS wins
       FROM players p JOIN appearances a ON a.id = p.id
       WHERE p.team_id = ?1
       GROUP BY p.id`,
    teamId,
    kind,
  );
}
