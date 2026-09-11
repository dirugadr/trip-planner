-- HU-2.6 — Recorridos visuales. New, isolated tables: a route template is a
-- named, ordered sequence of POIs a traveler can build on the map and later
-- apply to a day (generating activities). Deliberately NOT named "routes" —
-- that table already exists as the OSRM walk-time cache from HU-2.5.

CREATE TABLE IF NOT EXISTS route_templates (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(trip_id) REFERENCES trips(id)
);

CREATE INDEX IF NOT EXISTS idx_route_templates_trip_id ON route_templates(trip_id);
CREATE INDEX IF NOT EXISTS idx_route_templates_deleted_at ON route_templates(deleted_at);

CREATE TABLE IF NOT EXISTS route_template_stops (
  id TEXT PRIMARY KEY,
  route_template_id TEXT NOT NULL,
  poi_id TEXT NOT NULL,
  sequence_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(route_template_id) REFERENCES route_templates(id),
  FOREIGN KEY(poi_id) REFERENCES pois_saved(id)
);

CREATE INDEX IF NOT EXISTS idx_route_template_stops_template_id ON route_template_stops(route_template_id);
CREATE INDEX IF NOT EXISTS idx_route_template_stops_poi_id ON route_template_stops(poi_id);
