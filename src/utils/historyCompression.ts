import { HistoryPoint, TravelerHistoryRecord } from '@/types/history';
import { TravelMode } from '@/types/member';
import { calculateDistanceMeters } from './geoMath';

/**
 * Calculates perpendicular distance in meters from point P to line segment AB.
 */
export function perpendicularDistanceMeters(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): number {
  const [lngP, latP] = point;
  const [lngA, latA] = lineStart;
  const [lngB, latB] = lineEnd;

  // If endpoints are identical, return distance to lineStart
  if (lngA === lngB && latA === latB) {
    return calculateDistanceMeters({ lat: latP, lng: lngP }, { lat: latA, lng: lngA });
  }

  // Equirectangular planar approximation for high precision over small to medium distances
  const rad = Math.PI / 180;
  const midLat = ((latA + latB) / 2) * rad;
  const cosLat = Math.cos(midLat);

  const xP = lngP * cosLat;
  const yP = latP;
  const xA = lngA * cosLat;
  const yA = latA;
  const xB = lngB * cosLat;
  const yB = latB;

  const dx = xB - xA;
  const dy = yB - yA;
  const lenSq = dx * dx + dy * dy;

  // Projection parameter t
  let t = ((xP - xA) * dx + (yP - yA) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = xA + t * dx;
  const projY = yA + t * dy;

  // Convert delta degrees back to meters (approx 111,320m per degree latitude)
  const dXDeg = (xP - projX) / cosLat;
  const dYDeg = yP - projY;

  return calculateDistanceMeters(
    { lat: latP, lng: lngP },
    { lat: latP - dYDeg, lng: lngP - dXDeg }
  );
}

/**
 * Ramer-Douglas-Peucker (RDP) polyline simplification algorithm.
 * Reduces raw high-frequency GPS points to essential path vertices.
 * Matches Section 13 of Developer Handoff.
 *
 * @param coordinates Array of GeoJSON [lng, lat] coordinates
 * @param epsilonMeters Distance threshold in meters (default 20m)
 */
export function simplifyPolylineRdp(
  coordinates: Array<[number, number]>,
  epsilonMeters: number = 20
): Array<[number, number]> {
  if (coordinates.length <= 2) {
    return coordinates;
  }

  let maxDistance = 0;
  let maxIndex = 0;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  for (let i = 1; i < coordinates.length - 1; i++) {
    const dist = perpendicularDistanceMeters(coordinates[i], first, last);
    if (dist > maxDistance) {
      maxDistance = dist;
      maxIndex = i;
    }
  }

  if (maxDistance > epsilonMeters) {
    const left = simplifyPolylineRdp(coordinates.slice(0, maxIndex + 1), epsilonMeters);
    const right = simplifyPolylineRdp(coordinates.slice(maxIndex), epsilonMeters);
    return left.slice(0, left.length - 1).concat(right);
  }

  return [first, last];
}

/**
 * Processes raw GPS sensor fixes into a compressed historical journey record.
 */
export function computeTravelerSummary(
  rawSamples: HistoryPoint[],
  member: {
    uid: string;
    name: string;
    travelMode: TravelMode;
    startedAt: number;
    finishedAt?: number;
  },
  epsilonMeters: number = 20
): TravelerHistoryRecord {
  if (!rawSamples || rawSamples.length === 0) {
    const now = Date.now();
    return {
      uid: member.uid,
      name: member.name,
      travelMode: member.travelMode,
      startedAt: member.startedAt,
      finishedAt: member.finishedAt || now,
      totalDistanceM: 0,
      durationS: Math.max(1, Math.round(((member.finishedAt || now) - member.startedAt) / 1000)),
      avgSpeedKmh: 0,
      maxSpeedKmh: 0,
      compressedPolyline: [],
      pointsSampleCount: 0,
    };
  }

  // Sort chronologically
  const sorted = [...rawSamples].sort((a, b) => a.timestamp - b.timestamp);

  let totalDistanceM = 0;
  let maxSpeedMps = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].speedMps > maxSpeedMps) {
      maxSpeedMps = sorted[i].speedMps;
    }

    if (i > 0) {
      const dist = calculateDistanceMeters(
        { lat: sorted[i - 1].lat, lng: sorted[i - 1].lng },
        { lat: sorted[i].lat, lng: sorted[i].lng }
      );
      totalDistanceM += dist;
    }
  }

  const startedAt = member.startedAt || sorted[0].timestamp;
  const finishedAt = member.finishedAt || sorted[sorted.length - 1].timestamp;
  const durationS = Math.max(1, Math.round((finishedAt - startedAt) / 1000));
  const avgSpeedKmh = Math.round((totalDistanceM / durationS) * 3.6 * 10) / 10;
  const maxSpeedKmh = Math.round(maxSpeedMps * 3.6 * 10) / 10;

  // Extract coordinates as GeoJSON [lng, lat]
  const rawCoords: Array<[number, number]> = sorted.map((p) => [p.lng, p.lat]);
  const compressedPolyline = simplifyPolylineRdp(rawCoords, epsilonMeters);

  return {
    uid: member.uid,
    name: member.name,
    travelMode: member.travelMode,
    startedAt,
    finishedAt,
    totalDistanceM: Math.round(totalDistanceM),
    durationS,
    avgSpeedKmh,
    maxSpeedKmh,
    compressedPolyline,
    pointsSampleCount: sorted.length,
  };
}
