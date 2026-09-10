-- A POI can be auto-generated from an accommodation (HU-8.6): same pattern as
-- expenses.accommodation_id (006) and activities.accommodation_id (007).
-- Name + location sync from the accommodation; soft-deleted when it is deleted.

ALTER TABLE pois_saved ADD COLUMN accommodation_id TEXT REFERENCES accommodations(id);

CREATE INDEX IF NOT EXISTS idx_pois_saved_accommodation_id ON pois_saved(accommodation_id);
