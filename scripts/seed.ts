/** Loads seed data into the database: match sheets from data/seed/matches/, schedule from data/seed/fixtures.json. Safe to re-run. */
import { readdirSync, readFileSync } from "node:fs";
import { db } from "../lib/db.ts";
import { insertMatch, upsertFixture, type FixtureInput, type MatchInput } from "../lib/repo.ts";

const seed = new URL("../data/seed/", import.meta.url);
const readJson = <T>(url: URL): T => JSON.parse(readFileSync(url, "utf8"));

const matches = new URL("matches/", seed);
for (const file of readdirSync(matches).filter((f) => f.endsWith(".json"))) {
  const match = readJson<MatchInput>(new URL(file, matches));
  const exists = db().prepare("SELECT 1 FROM matches WHERE source = ? AND played_on = ?").get(match.source, match.playedOn);
  if (exists) {
    console.log(`skip  ${file} (already loaded)`);
    continue;
  }
  insertMatch(match);
  console.log(`load  ${file}: ${match.home} vs ${match.away}, ${match.games.length} games`);
}

for (const fixture of readJson<FixtureInput[]>(new URL("fixtures.json", seed))) {
  upsertFixture(fixture);
  console.log(`sched ${fixture.playOn}: ${fixture.team} ${fixture.isHome ? "vs" : "@"} ${fixture.opponent}`);
}
