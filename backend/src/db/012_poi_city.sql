-- City per POI (HU-2.7), extracted client-side from the Nominatim address
-- breakdown when resolving a location. Nullable, free text — no lookup table,
-- just used to populate the city filter dropdown.

ALTER TABLE pois_saved ADD COLUMN city TEXT;
