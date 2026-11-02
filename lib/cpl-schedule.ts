/** Keeps the database in step with CPL. Runs from the Cloudflare Cron Trigger in custom-worker.ts. */
import { all } from "./db.ts";
import { DEFAULT_DIVISION_ID, syncFromCpl } from "./cpl.ts";

/** Syncs every team that has a captain. Failures are logged per team so one can't block the rest. */
export async function syncAllTeams(divisionId = DEFAULT_DIVISION_ID) {
  const teams = await all<{ name: string }>("SELECT DISTINCT t.name FROM captains c JOIN teams t ON t.id = c.team_id");
  if (teams.length === 0) console.log("CPL sync: no captains yet. Add one with `npm run captain`.");

  for (const { name } of teams) {
    try {
      const { division, fixtures, imported } = await syncFromCpl(name, divisionId);
      console.log(`CPL sync: ${name} (${division}): ${fixtures} upcoming, ${imported} new matches`);
    } catch (err) {
      console.error(`CPL sync failed for ${name}:`, err);
    }
  }
}
