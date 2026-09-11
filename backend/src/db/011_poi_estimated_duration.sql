-- Optional estimated visit duration per POI (ajuste a HU-2.1), prep for HU-2.6.
-- Existing rows stay NULL ("no data") — no default by category here.

ALTER TABLE pois_saved ADD COLUMN estimated_duration_minutes INTEGER;
