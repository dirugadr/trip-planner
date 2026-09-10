-- Cache of walking times between POIs (HU-2.5). OSRM foot-routing results are
-- reused so we don't re-query the public server for a pair already computed.
-- Directed pairs (from,to) — OSRM foot routes can differ slightly by direction.
-- Only real OSRM results are cached; haversine fallbacks are recomputed on the
-- fly (instant) so a later run can still get the real value.

CREATE TABLE IF NOT EXISTS poi_walk_times (
  from_poi_id TEXT NOT NULL,
  to_poi_id TEXT NOT NULL,
  minutes REAL NOT NULL,
  source TEXT NOT NULL,          -- 'osrm'
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (from_poi_id, to_poi_id),
  FOREIGN KEY (from_poi_id) REFERENCES pois_saved(id),
  FOREIGN KEY (to_poi_id) REFERENCES pois_saved(id)
);
