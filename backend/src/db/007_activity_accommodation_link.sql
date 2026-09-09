-- Auto-generated check-in / check-out activities are linked back to their
-- accommodation so edits/deletes can keep them in sync (Épica 8).

ALTER TABLE activities ADD COLUMN accommodation_id TEXT REFERENCES accommodations(id);
ALTER TABLE activities ADD COLUMN accommodation_role TEXT; -- 'check_in' | 'check_out'

CREATE INDEX IF NOT EXISTS idx_activities_accommodation_id ON activities(accommodation_id);
