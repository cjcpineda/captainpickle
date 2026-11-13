import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get, run } from "./db.ts";
import { verifyPassword } from "./password.ts";

/** A signed-in captain. Everything they see is scoped to their team, and their team's CPL division. */
export type Captain = {
  id: number;
  email: string;
  name: string;
  teamId: number;
  teamName: string;
  divisionId: string;
  division: string | null;
};

const COOKIE = "cp_session";
const SESSION_DAYS = 30;

export async function signIn(email: string, password: string): Promise<boolean> {
  const row = await get<{ id: number; hash: string }>(
    "SELECT id, password_hash AS hash FROM captains WHERE email = ?",
    email.trim(),
  );
  if (!row || !verifyPassword(password, row.hash)) return false;

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await run("INSERT INTO sessions (token, captain_id, expires_at) VALUES (?, ?, ?)", token, row.id, expires.toISOString());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires, path: "/" });
  return true;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await run("DELETE FROM sessions WHERE token = ?", token);
  jar.delete(COOKIE);
}

export async function currentCaptain(): Promise<Captain | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const captain = await get<Captain>(
    `SELECT c.id, c.email, c.name, c.team_id AS teamId, t.name AS teamName,
            t.division_id AS divisionId, t.division
     FROM sessions s JOIN captains c ON c.id = s.captain_id JOIN teams t ON t.id = c.team_id
     WHERE s.token = ? AND s.expires_at > ?`,
    token,
    new Date().toISOString(),
  );
  return captain ?? null;
}

/** For pages: the signed-in captain, or a redirect to the login page. */
export async function requireCaptain(): Promise<Captain> {
  const captain = await currentCaptain();
  if (!captain) redirect("/login");
  return captain;
}
