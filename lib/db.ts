import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS teams (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS players (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL COLLATE NOCASE,
  gender          TEXT CHECK (gender IN ('M', 'F')),
  team_id         INTEGER REFERENCES teams(id),
  UNIQUE (name, team_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('league', 'practice')),
  played_on   TEXT NOT NULL,
  home_id     INTEGER NOT NULL REFERENCES teams(id),
  away_id     INTEGER NOT NULL REFERENCES teams(id),
  source      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id        INTEGER PRIMARY KEY,
  match_id  INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round     INTEGER,
  a1        INTEGER NOT NULL REFERENCES players(id),
  a2        INTEGER NOT NULL REFERENCES players(id),
  b1        INTEGER NOT NULL REFERENCES players(id),
  b2        INTEGER NOT NULL REFERENCES players(id),
  score_a   INTEGER NOT NULL,
  score_b   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fixtures (
  id          INTEGER PRIMARY KEY,
  team_id     INTEGER NOT NULL REFERENCES teams(id),
  opponent_id INTEGER NOT NULL REFERENCES teams(id),
  play_on     TEXT NOT NULL,
  location    TEXT,
  UNIQUE (team_id, opponent_id, play_on)
);

CREATE TABLE IF NOT EXISTS captains (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  team_id       INTEGER NOT NULL REFERENCES teams(id),
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  captain_id INTEGER NOT NULL REFERENCES captains(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id         INTEGER PRIMARY KEY,
  captain_id INTEGER NOT NULL REFERENCES captains(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  messages   TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const globalForDb = globalThis as unknown as { db?: DatabaseSync };

export function db(): DatabaseSync {
  if (!globalForDb.db) {
    const path = process.env.DATABASE_PATH ?? "data/captainpickle.db";
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const conn = new DatabaseSync(path);
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    conn.exec(SCHEMA);
    globalForDb.db = conn;
  }
  return globalForDb.db;
}

export function transaction<T>(fn: () => T): T {
  const conn = db();
  conn.exec("BEGIN");
  try {
    const result = fn();
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}
