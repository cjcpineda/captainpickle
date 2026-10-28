/** Keeps the database in step with CPL: syncs once at server start, then every few hours. */
import { db } from "./db.ts";
import { DEFAULT_DIVISION_ID, syncFromCpl } from "./cpl.ts";

const EVERY_MS = 6 * 60 * 60 * 1000;

export function startCplSync() {
  if (process.env.CPL_SYNC === "off") return;
  void syncAllTeams();
  setInterval(syncAllTeams, EVERY_MS).unref();
}

/** Syncs every team that has a captain. Failures are logged per team so one can't block the rest. */
export async function syncAllTeams() {
  const teams = db()
    .prepare("SELECT DISTINCT t.name FROM captains c JOIN teams t ON t.id = c.team_id")
    .all() as { name: string }[];
  if (teams.length === 0) console.log("CPL sync: no captains yet. Add one with `npm run captain`.");

  for (const { name } of teams) {
    try {
      const { division, fixtures, imported } = await syncFromCpl(name, process.env.CPL_DIVISION_ID ?? DEFAULT_DIVISION_ID);
      console.log(`CPL sync: ${name} (${division}): ${fixtures} upcoming, ${imported} new matches`);
    } catch (err) {
      console.error(`CPL sync failed for ${name}:`, err);
    }
  }
}
