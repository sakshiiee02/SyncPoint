/**
 * SyncPoint Initial Configuration Constants
 * Directly matched to Section 32 of Developer Handoff
 */

export const CONFIG = {
  // Maximum members allowed in a single journey (including creator)
  MAX_MEMBERS: 10,

  // Adaptive sampling intervals (in milliseconds)
  SAMPLING: {
    FAST_INTERVAL_MS: 2500, // > 50 km/h (highway speeds)
    NORMAL_INTERVAL_MS: 5000, // 15 - 50 km/h (city roads)
    SLOW_INTERVAL_MS: 8000, // 3 - 15 km/h (congested / walking)
    STATIONARY_INTERVAL_MS: 25000, // < 3 km/h (stopped heartbeat)
    MIN_PUBLISH_DISTANCE_M: 30, // Publish if moved >= 30m even before timer
    MIN_FAST_PUBLISH_MS: 1500, // Minimum delay between forced distance publishes
    HEADING_CHANGE_THRESHOLD_DEG: 25, // Heading delta to force an update while moving
  },

  // UI recency warning threshold (1 minute without update = stale)
  STALE_WARNING_MS: 60000,

  // Arrival detection geofence radius (in meters)
  ARRIVAL_RADIUS_M: 120,

  // Off-route reroute threshold (in meters)
  ROUTE_REROUTE_THRESHOLD_M: 75,

  // Short join code settings
  JOIN_CODE: {
    LENGTH: 6,
    ALPHABET: '23456789ABCDEFGHJKLMNPQRSTUVWXYZ', // Avoids 0/O, 1/I confusion
    DEFAULT_EXPIRY_HOURS: 24,
  },

  // Map & Tiles
  MAP: {
    DEFAULT_ZOOM: 14,
    MIN_ZOOM: 3,
    MAX_ZOOM: 19,
    PADDING_PX: 60,
    TILE_URL: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  },

  // Routing
  ROUTING: {
    DEFAULT_OSRM_URL: 'https://router.project-osrm.org',
    TIMEOUT_MS: 8000,
  },
} as const;
