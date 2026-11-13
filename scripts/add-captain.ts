/**
 * Creates (or updates) a captain account in the D1 database, on a team in one CPL division.
 *   npm run captain -- <email> "<name>" "<team>" <password> [--division "NJ / PA 3.0"] [--remote]
 *
 * The same club name plays in several divisions (Pickleball Kingdom Tinton Falls is in 3.0, 3.5 and 4.0),
 * so a team is a name within a division. --division takes the name as crossclubpickleball.com shows it
 * ("NJ / PA 3.0"), or a CPL division id. Without it, the team's division is looked up on CPL; if the
 * name plays in more than one, the script lists them and asks you to pick.
 */
import { execFileSync } from "node:child_process";
import { divisions, divisionTeams, type Division } from "../lib/cpl.ts";
import { hashPassword } from "../lib/password.ts";

const USAGE = 'Usage: npm run captain -- <email> "<name>" "<team>" <password> [--division "NJ / PA 3.0"] [--remote]';

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const divisionAt = args.indexOf("--division");
const divisionArg = divisionAt >= 0 ? args[divisionAt + 1] : undefined;
const positional = args.filter((a, i) => a !== "--remote" && (divisionAt < 0 || (i !== divisionAt && i !== divisionAt + 1)));
const [email, name, team, password] = positional;
if (!email || !name || !team || !password || (divisionAt >= 0 && !divisionArg)) fail(USAGE);

const division = await pickDivision(team.trim(), divisionArg);

/** A SQL string literal. */
const q = (value: string) => `'${value.trim().replaceAll("'", "''")}'`;

const sql = `
INSERT INTO teams (name, division_id, division) VALUES (${q(team)}, ${q(division.id)}, ${q(division.name)})
  ON CONFLICT (name, division_id) DO UPDATE SET division = excluded.division;
INSERT INTO captains (email, name, team_id, password_hash)
VALUES (${q(email)}, ${q(name)}, (SELECT id FROM teams WHERE name = ${q(team)} AND division_id = ${q(division.id)}), ${q(hashPassword(password))})
ON CONFLICT (email) DO UPDATE SET name = excluded.name, team_id = excluded.team_id, password_hash = excluded.password_hash;`;

execFileSync("npx", ["wrangler", "d1", "execute", "captainpickle", remote ? "--remote" : "--local", "--command", sql], {
  stdio: "inherit",
});
console.log(`Captain ${name} <${email}> can now sign in for ${team} (${division.name}). Run a sync to pull its schedule.`);

async function pickDivision(team: string, wanted: string | undefined): Promise<Division> {
  const all = await divisions();
  const teamIn = async (d: Division) =>
    (await divisionTeams(d.id)).some((t) => t.toLowerCase() === team.toLowerCase());

  if (wanted) {
    const key = wanted.trim().toLowerCase();
    const found = all.find((d) => d.id === key || d.name.toLowerCase() === key);
    if (!found) fail(`No CPL division "${wanted}". Divisions:\n${all.map((d) => `  ${d.name}`).join("\n")}`);
    if (!(await teamIn(found))) fail(`"${team}" isn't a team in ${found.name}. Check the spelling on crossclubpickleball.com.`);
    return found;
  }

  const homes: Division[] = [];
  for (const d of all) if (await teamIn(d)) homes.push(d);
  if (homes.length === 1) return homes[0];
  if (homes.length === 0) fail(`No CPL division has a team named "${team}". Check the spelling on crossclubpickleball.com.`);
  fail(`"${team}" plays in more than one division. Add one of these:\n${homes.map((d) => `  --division "${d.name}"`).join("\n")}`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
