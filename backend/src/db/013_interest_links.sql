-- Epica 9 — Links de interes. Completely new, isolated feature: no FK from
-- any existing table points here, only trip_id points out. Tags are scoped
-- per trip (UNIQUE(trip_id, name)) and reused across links; deleting a link
-- (soft) never deletes its tags, so they stay available for reuse.

CREATE TABLE IF NOT EXISTS interest_links (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(trip_id) REFERENCES trips(id)
);

CREATE INDEX IF NOT EXISTS idx_interest_links_trip_id ON interest_links(trip_id);
CREATE INDEX IF NOT EXISTS idx_interest_links_deleted_at ON interest_links(deleted_at);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(trip_id) REFERENCES trips(id),
  UNIQUE(trip_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_trip_id ON tags(trip_id);

CREATE TABLE IF NOT EXISTS interest_link_tags (
  interest_link_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY(interest_link_id, tag_id),
  FOREIGN KEY(interest_link_id) REFERENCES interest_links(id),
  FOREIGN KEY(tag_id) REFERENCES tags(id)
);

CREATE INDEX IF NOT EXISTS idx_interest_link_tags_tag_id ON interest_link_tags(tag_id);
