-- "Inamovible" flag for activities — a fixed-time commitment (e.g. an entry
-- ticket with an assigned slot) that automatic schedule shifting must never move.
ALTER TABLE activities ADD COLUMN is_fixed INTEGER NOT NULL DEFAULT 0;
