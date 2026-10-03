# OSRM Routing Service for SyncPoint

SyncPoint relies on the Open Source Routing Machine (OSRM) for turn-by-turn route calculations, maneuvers, and road matching.

## Available Profiles
- **Car**: `/route/v1/driving/{coords}?overview=full&geometries=geojson&steps=true`
- **Bike**: `/route/v1/bike/{coords}?overview=full&geometries=geojson&steps=true`
- **Foot / Walk**: `/route/v1/foot/{coords}?overview=full&geometries=geojson&steps=true`

## Local Development vs. Production
- **Local Testing**: Uses `https://router.project-osrm.org` as fallback demo endpoint.
- **Self-Hosted Production**: Run via Docker using the provided `docker-compose.yml` to prevent rate-limiting and ensure 99.9% uptime.
