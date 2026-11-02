-- Initial schema (same tables the local SQLite version used).
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
  cpl_id      TEXT,
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
  start_time  TEXT NOT NULL DEFAULT '19:30',
  is_home     INTEGER NOT NULL DEFAULT 0,
  division    TEXT,
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

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id         INTEGER PRIMARY KEY,
  captain_id INTEGER NOT NULL REFERENCES captains(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  messages   TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS matches_cpl_id ON matches (cpl_id);
