/**
 * Pulls schedules and match history from Cross Club Pickleball for every captain's team.
 * The server also does this on its own at startup and every six hours.
 *   npm run sync
 */
import { syncAllTeams } from "../lib/cpl-schedule.ts";

await syncAllTeams();
