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
  // Arrival radius by travel mode: a walker has to be much closer than a car.
  ARRIVAL_RADIUS_BY_MODE: { CAR: 120, BIKE: 80, WALK: 50 },

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
    TILE_URL: 'https://tiles.openfreemap.org/styles/bright',
  },

  // Routing (OpenRouteService primary, public OSRM as a free fallback)
  ROUTING: {
    ORS_BASE_URL: 'https://api.openrouteservice.org',
    OSRM_BASE_URLS: {
      CAR: 'https://routing.openstreetmap.de/routed-car',
      BIKE: 'https://routing.openstreetmap.de/routed-bike',
      WALK: 'https://routing.openstreetmap.de/routed-foot',
    },
    TIMEOUT_MS: 12000,
    ROUTE_CACHE_TTL_MS: 30 * 60 * 1000,
  },

  // Free-tier rationing per device per day (providers' real limits are higher and shared by all users).
  DAILY_QUOTA: {
    geoapify: 2400,
    locationiq: 4000,
    ors: 1200,
    osrm: 3000,
  },
} as const;
