import { LatLng, calculateDistanceMeters } from '@/utils/geoMath';

/**
 * Position of a point *along* a route polyline. This is what makes "distance remaining" and
 * "next turn" correct: straight-line distance to the destination is wrong on any winding road.
 */
export interface RouteIndex {
  coords: Array<[number, number]>; // GeoJSON [lng, lat]
  /** cum[i] = metres along the polyline from vertex 0 to vertex i. */
  cum: number[];
  totalM: number;
}

export interface RoutePosition {
  /** Metres from the start of the route to the closest point on it. */
  alongM: number;
  /** Metres between the point and the route (how far off-route). */
  crossTrackM: number;
  segmentIndex: number;
}

const indexCache = new WeakMap<object, RouteIndex>();

export function indexRoute(coords: Array<[number, number]>): RouteIndex {
  const cached = indexCache.get(coords);
  if (cached) return cached;

  const cum: number[] = new Array(coords.length);
  let total = 0;
  cum[0] = 0;
  for (let i = 1; i < coords.length; i++) {
    total += calculateDistanceMeters(
      { lat: coords[i - 1][1], lng: coords[i - 1][0] },
      { lat: coords[i][1], lng: coords[i][0] }
    );
    cum[i] = total;
  }
  const index: RouteIndex = { coords, cum, totalM: total };
  indexCache.set(coords, index);
  return index;
}

const METERS_PER_DEG_LAT = 111_320;

/** Closest point on segment i, in a local flat frame centred on `p`. */
function projectOnSegment(index: RouteIndex, i: number, p: LatLng, cosLat: number) {
  const [lngA, latA] = index.coords[i];
  const [lngB, latB] = index.coords[i + 1];
  const ax = (lngA - p.lng) * cosLat * METERS_PER_DEG_LAT;
  const ay = (latA - p.lat) * METERS_PER_DEG_LAT;
  const bx = (lngB - p.lng) * cosLat * METERS_PER_DEG_LAT;
  const by = (latB - p.lat) * METERS_PER_DEG_LAT;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx - ay * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { t, dist: Math.sqrt(cx * cx + cy * cy) };
}

function searchRange(index: RouteIndex, p: LatLng, from: number, to: number): RoutePosition {
  const cosLat = Math.cos((p.lat * Math.PI) / 180);
  let best: RoutePosition = { alongM: 0, crossTrackM: Infinity, segmentIndex: from };
  for (let i = from; i < to; i++) {
    const { t, dist } = projectOnSegment(index, i, p, cosLat);
    if (dist < best.crossTrackM) {
      const segLen = index.cum[i + 1] - index.cum[i];
      best = { alongM: index.cum[i] + t * segLen, crossTrackM: dist, segmentIndex: i };
    }
  }
  return best;
}

/**
 * Projects `p` onto the route. When the previous segment is known, only a window around it is
 * searched (cheap, and avoids snapping to a distant part of a looping route); if that window
 * looks off-route the whole polyline is searched.
 */
export function projectOntoRoute(
  index: RouteIndex,
  p: LatLng,
  hintSegment?: number
): RoutePosition {
  const segments = index.coords.length - 1;
  if (segments < 1) return { alongM: 0, crossTrackM: Infinity, segmentIndex: 0 };

  if (hintSegment !== undefined) {
    const from = Math.max(0, hintSegment - 30);
    const to = Math.min(segments, hintSegment + 300);
    const windowed = searchRange(index, p, from, to);
    if (windowed.crossTrackM <= 150) return windowed;
  }
  return searchRange(index, p, 0, segments);
}
