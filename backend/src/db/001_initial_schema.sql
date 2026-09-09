-- Initial schema for Trip Planner
-- Created: 2026-09-08

-- ============================================
-- POI Categories (Reference Table)
-- ============================================
CREATE TABLE IF NOT EXISTS poi_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Transport Modes (Reference Table)
-- ============================================
CREATE TABLE IF NOT EXISTS transport_modes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Trips
-- ============================================
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  currency_code TEXT DEFAULT 'USD',
  total_budget DECIMAL(12,2),
  timezone TEXT DEFAULT 'UTC',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at);
CREATE INDEX IF NOT EXISTS idx_trips_deleted_at ON trips(deleted_at);

-- ============================================
-- Days
-- ============================================
CREATE TABLE IF NOT EXISTS days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  date DATE NOT NULL,
  title TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER DEFAULT 1,
  FOREIGN KEY(trip_id) REFERENCES trips(id),
  UNIQUE(trip_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_days_trip_id ON days(trip_id);
CREATE INDEX IF NOT EXISTS idx_days_date ON days(date);

-- ============================================
-- Activities
-- ============================================
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  day_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TEXT,
  duration_minutes INTEGER,
  location_name TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  url TEXT,
  completed BOOLEAN DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER DEFAULT 1,
  FOREIGN KEY(day_id) REFERENCES days(id)
);

CREATE INDEX IF NOT EXISTS idx_activities_day_id ON activities(day_id);
CREATE INDEX IF NOT EXISTS idx_activities_start_time ON activities(start_time);
CREATE INDEX IF NOT EXISTS idx_activities_deleted_at ON activities(deleted_at);

-- ============================================
-- POIs Saved
-- ============================================
CREATE TABLE IF NOT EXISTS pois_saved (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER DEFAULT 1,
  FOREIGN KEY(trip_id) REFERENCES trips(id),
  FOREIGN KEY(category_id) REFERENCES poi_categories(id)
);

CREATE INDEX IF NOT EXISTS idx_pois_saved_trip_id ON pois_saved(trip_id);
CREATE INDEX IF NOT EXISTS idx_pois_saved_category_id ON pois_saved(category_id);

-- ============================================
-- Activity POIs (N:N Relationship)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_pois (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  poi_id TEXT NOT NULL,
  sequence_order INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY(activity_id) REFERENCES activities(id),
  FOREIGN KEY(poi_id) REFERENCES pois_saved(id),
  UNIQUE(activity_id, poi_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_pois_activity_id ON activity_pois(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_pois_poi_id ON activity_pois(poi_id);

-- ============================================
-- Routes Between POIs
-- ============================================
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  day_id TEXT NOT NULL,
  from_poi_id TEXT NOT NULL,
  to_poi_id TEXT NOT NULL,
  transport_mode_id TEXT NOT NULL,
  estimated_duration_minutes INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  FOREIGN KEY(day_id) REFERENCES days(id),
  FOREIGN KEY(from_poi_id) REFERENCES pois_saved(id),
  FOREIGN KEY(to_poi_id) REFERENCES pois_saved(id),
  FOREIGN KEY(transport_mode_id) REFERENCES transport_modes(id)
);

CREATE INDEX IF NOT EXISTS idx_routes_day_id ON routes(day_id);
CREATE INDEX IF NOT EXISTS idx_routes_from_poi_id ON routes(from_poi_id);
CREATE INDEX IF NOT EXISTS idx_routes_to_poi_id ON routes(to_poi_id);

-- ============================================
-- Budget Categories
-- ============================================
CREATE TABLE IF NOT EXISTS budget_categories (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  name TEXT NOT NULL,
  allocated_budget DECIMAL(12,2),
  created_at TEXT NOT NULL,
  FOREIGN KEY(trip_id) REFERENCES trips(id),
  UNIQUE(trip_id, name)
);

CREATE INDEX IF NOT EXISTS idx_budget_categories_trip_id ON budget_categories(trip_id);

-- ============================================
-- Expenses
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  activity_id TEXT,
  amount DECIMAL(12,2) NOT NULL,
  currency_code TEXT NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER DEFAULT 1,
  FOREIGN KEY(trip_id) REFERENCES trips(id),
  FOREIGN KEY(category_id) REFERENCES budget_categories(id),
  FOREIGN KEY(activity_id) REFERENCES activities(id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_activity_id ON expenses(activity_id);

-- ============================================
-- Documents
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  activity_id TEXT,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes INTEGER,
  uploaded_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY(trip_id) REFERENCES trips(id),
  FOREIGN KEY(activity_id) REFERENCES activities(id)
);

CREATE INDEX IF NOT EXISTS idx_documents_trip_id ON documents(trip_id);
CREATE INDEX IF NOT EXISTS idx_documents_activity_id ON documents(activity_id);

-- ============================================
-- Sync Logs (for offline synchronization)
-- ============================================
CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  local_version INTEGER NOT NULL,
  server_version INTEGER,
  synced BOOLEAN DEFAULT 0,
  sync_attempt_count INTEGER DEFAULT 0,
  last_sync_attempt TEXT,
  conflict BOOLEAN DEFAULT 0,
  conflict_resolution TEXT,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  FOREIGN KEY(trip_id) REFERENCES trips(id)
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_trip_id ON sync_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_synced ON sync_logs(synced);
CREATE INDEX IF NOT EXISTS idx_sync_logs_conflict ON sync_logs(conflict);
