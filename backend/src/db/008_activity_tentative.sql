-- "Tentative" flag for activities — plans that aren't confirmed yet.

ALTER TABLE activities ADD COLUMN tentative INTEGER NOT NULL DEFAULT 0;
