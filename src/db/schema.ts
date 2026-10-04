/**
 * On-device database. Everything here is *local* state that must survive Android killing the app:
 *  - the route being followed (so navigation works instantly, even with no signal),
 *  - the GPS track recorded so far (so a trip's history isn't lost if the app is killed mid-trip),
 *  - chat messages typed while offline, waiting to be sent.
 * Live positions are NOT queued: a position is only useful fresh, so after an outage we publish the
 * latest one rather than replaying old ones.
 */
export const SCHEMA_VERSION = 1;

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS route_cache (
     journey_id TEXT PRIMARY KEY,
     route_json TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS track_points (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     journey_id TEXT NOT NULL,
     ts INTEGER NOT NULL,
     lat REAL NOT NULL,
     lng REAL NOT NULL,
     speed_mps REAL NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_track_points_journey ON track_points (journey_id, ts)`,
  `CREATE TABLE IF NOT EXISTS chat_outbox (
     id TEXT PRIMARY KEY,
     journey_id TEXT NOT NULL,
     message_json TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
];
