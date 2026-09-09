-- Accommodations per trip (Épica 8). check_in / check_out are 'YYYY-MM-DDTHH:MM'.

CREATE TABLE IF NOT EXISTS accommodations (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  name TEXT NOT NULL,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  booking_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER DEFAULT 1,
  FOREIGN KEY(trip_id) REFERENCES trips(id)
);

CREATE INDEX IF NOT EXISTS idx_accommodations_trip_id ON accommodations(trip_id);

-- Link an expense to the accommodation it paid for.
ALTER TABLE expenses ADD COLUMN accommodation_id TEXT REFERENCES accommodations(id);

CREATE INDEX IF NOT EXISTS idx_expenses_accommodation_id ON expenses(accommodation_id);
