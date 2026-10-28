/** Loads match sheets from data/seed/ into the database. Safe to re-run. */
import { readdirSync, readFileSync } from "node:fs";
import { db } from "../lib/db.ts";
import { insertMatch, type MatchInput } from "../lib/repo.ts";

const dir = new URL("../data/seed/", import.meta.url);

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const match: MatchInput = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
  const exists = db()
    .prepare("SELECT 1 FROM matches WHERE source = ? AND played_on = ?")
    .get(match.source, match.playedOn);
  if (exists) {
    console.log(`skip  ${file} (already loaded)`);
    continue;
  }
  insertMatch(match);
  console.log(`load  ${file}: ${match.home} vs ${match.away}, ${match.games.length} games`);
}
