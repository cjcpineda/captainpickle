-- Teams belong to a CPL division. Clubs field a team with the same name in several divisions
-- (Pickleball Kingdom Tinton Falls plays in 3.0, 3.5 and 4.0), so a team is a name *within* a division.
-- SQLite can't change a UNIQUE constraint in place, so the table is rebuilt; ids are kept, so every
-- reference to a team stays valid.
PRAGMA defer_foreign_keys = true;

CREATE TABLE teams_new (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL COLLATE NOCASE,
  division_id  TEXT NOT NULL,
  division     TEXT,
  UNIQUE (name, division_id)
);

-- Everything synced so far came from the old default division, NJ / PA 4.0.
INSERT INTO teams_new (id, name, division_id, division)
  SELECT id, name, 'a1413f3d-5f4b-4ad4-b5cf-c21c7c8b7d66', 'NJ / PA 4.0' FROM teams;

DROP TABLE teams;
ALTER TABLE teams_new RENAME TO teams;

-- Player records were saved per team name; they're now saved per team id and refilled on the next sync.
DELETE FROM meta WHERE key LIKE 'cpl_player_records:%';

PRAGMA defer_foreign_keys = false;
