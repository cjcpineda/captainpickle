/** Keeps the database in step with CPL. Runs from the Cloudflare Cron Trigger in custom-worker.ts. */
import { all } from "./db.ts";
import { syncFromCpl } from "./cpl.ts";
import type { Team } from "./repo.ts";

/**
 * Syncs every team that has a captain, each from its own CPL division.
 * Failures are logged per team so one can't block the rest.
 */
export async function syncAllTeams() {
  const teams = await all<Team>(
    `SELECT DISTINCT t.id, t.name, t.division_id AS divisionId, t.division
       FROM captains c JOIN teams t ON t.id = c.team_id`,
  );
  if (teams.length === 0) console.log("CPL sync: no captains yet. Add one with `npm run captain`.");

  for (const team of teams) {
    try {
      const { division, fixtures, imported } = await syncFromCpl(team);
      console.log(`CPL sync: ${team.name} (${division}): ${fixtures} upcoming, ${imported} new matches`);
    } catch (err) {
      console.error(`CPL sync failed for ${team.name} (${team.division ?? team.divisionId}):`, err);
    }
  }
}
