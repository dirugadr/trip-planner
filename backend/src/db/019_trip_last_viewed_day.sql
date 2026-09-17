-- Ajuste itinerario (último día visto): so re-entering the Itinerario tab of
-- a trip lands on the day the traveler was last looking at, across devices.
ALTER TABLE trips ADD COLUMN last_viewed_day_id TEXT REFERENCES days(id);
