/**
 * Creates (or resets the password of) a captain account.
 *   npm run captain -- <email> "<name>" "<team>" <password>
 */
import { db } from "../lib/db.ts";
import { hashPassword } from "../lib/password.ts";
import { upsertTeam } from "../lib/repo.ts";

const [email, name, team, password] = process.argv.slice(2);
if (!email || !name || !team || !password) {
  console.error('Usage: npm run captain -- <email> "<name>" "<team>" <password>');
  process.exit(1);
}

db()
  .prepare(
    `INSERT INTO captains (email, name, team_id, password_hash) VALUES (?, ?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET name = excluded.name, team_id = excluded.team_id, password_hash = excluded.password_hash`,
  )
  .run(email, name, upsertTeam(team), hashPassword(password));

console.log(`Captain ${name} <${email}> can now sign in for ${team}.`);
