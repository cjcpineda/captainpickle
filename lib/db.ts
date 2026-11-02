/**
 * Database access. The app runs on Cloudflare Workers, so data lives in D1 (Cloudflare's SQLite).
 * The schema is in migrations/; apply it with `npm run db:migrate` (local) or `npm run db:migrate:remote`.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

type Param = string | number | null;

/** Set by code that runs outside a Next.js request (the cron handler), where the binding is passed in directly. */
let boundDb: D1Database | undefined;

export function useDatabase(database: D1Database) {
  boundDb = database;
}

function d1(): D1Database {
  return boundDb ?? getCloudflareContext().env.DB;
}

/** A prepared statement, for passing to batch(). */
export const stmt = (sql: string, ...params: Param[]) => d1().prepare(sql).bind(...params);

export async function all<T>(sql: string, ...params: Param[]): Promise<T[]> {
  return (await stmt(sql, ...params).all<T>()).results;
}

export async function get<T>(sql: string, ...params: Param[]): Promise<T | undefined> {
  return (await stmt(sql, ...params).first<T>()) ?? undefined;
}

export async function run(sql: string, ...params: Param[]) {
  return stmt(sql, ...params).run();
}

/** Runs statements in order as one transaction: all succeed or none do. */
export function batch(statements: D1PreparedStatement[]) {
  return statements.length > 0 ? d1().batch(statements) : Promise.resolve([]);
}

export async function getMeta(key: string): Promise<string | null> {
  const row = await get<{ value: string }>("SELECT value FROM meta WHERE key = ?", key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string) {
  await run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", key, value);
}
