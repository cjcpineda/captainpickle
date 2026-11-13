/**
 * Pulls schedules and match history from Cross Club Pickleball into the local D1 database.
 * On Cloudflare this runs on its own every six hours (the cron trigger in wrangler.jsonc).
 *   npm run sync
 */
import { getPlatformProxy } from "wrangler";
import { useDatabase } from "../lib/db.ts";
import { syncAllTeams } from "../lib/cpl-schedule.ts";

const { env, dispose } = await getPlatformProxy<CloudflareEnv>();
useDatabase(env.DB);
await syncAllTeams();
await dispose();
