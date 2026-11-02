/**
 * Creates (or resets the password of) a captain account in the D1 database.
 *   npm run captain -- <email> "<name>" "<team>" <password>            (local database)
 *   npm run captain -- <email> "<name>" "<team>" <password> --remote   (live database on Cloudflare)
 */
import { execFileSync } from "node:child_process";
import { hashPassword } from "../lib/password.ts";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const [email, name, team, password] = args.filter((a) => a !== "--remote");
if (!email || !name || !team || !password) {
  console.error('Usage: npm run captain -- <email> "<name>" "<team>" <password> [--remote]');
  process.exit(1);
}

/** A SQL string literal. */
const q = (value: string) => `'${value.trim().replaceAll("'", "''")}'`;

const sql = `
INSERT INTO teams (name) VALUES (${q(team)}) ON CONFLICT (name) DO NOTHING;
INSERT INTO captains (email, name, team_id, password_hash)
VALUES (${q(email)}, ${q(name)}, (SELECT id FROM teams WHERE name = ${q(team)}), ${q(hashPassword(password))})
ON CONFLICT (email) DO UPDATE SET name = excluded.name, team_id = excluded.team_id, password_hash = excluded.password_hash;`;

execFileSync("npx", ["wrangler", "d1", "execute", "captainpickle", remote ? "--remote" : "--local", "--command", sql], {
  stdio: "inherit",
});
console.log(`Captain ${name} <${email}> can now sign in for ${team}.`);
