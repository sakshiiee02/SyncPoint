-- SyncPoint Local SQLite Schema for Offline Resilience
-- Matches Section 12, 13, and 19 of Developer Handoff

CREATE TABLE IF NOT EXISTS cached_routes (
  route_id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  profile TEXT NOT NULL,
  geometry_json TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  distance_m INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  cached_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS offline_location_buffer (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  speed_mps REAL NOT NULL,
  heading REAL NOT NULL,
  battery_pct INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  is_synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS offline_chat_queue (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  sender_uid TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  msg_type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  is_sent INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS offline_map_packs (
  pack_id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bounds_json TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  downloaded_at INTEGER NOT NULL
);
