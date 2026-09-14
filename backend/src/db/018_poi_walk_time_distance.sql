-- Ajuste HU-2.6 (distancia total): the walking-time cache already gets a
-- distance in metres from the same OSRM response it uses for minutes, but
-- discarded it. Additive column, nullable so existing cached rows (computed
-- before this change) just have no distance until they're recomputed.
ALTER TABLE poi_walk_times ADD COLUMN distance_meters REAL;
