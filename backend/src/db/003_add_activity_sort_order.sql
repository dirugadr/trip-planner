-- Manual ordering for activities within a day (HU-1.10).
-- start_time stays the primary sort key; sort_order breaks ties and orders
-- activities that have no time.

ALTER TABLE activities ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows with a stable order (roughly insertion order).
UPDATE activities SET sort_order = rowid;

CREATE INDEX IF NOT EXISTS idx_activities_sort_order ON activities(day_id, sort_order);
