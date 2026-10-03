/**
 * Geodesic Math & Navigation Utilities for SyncPoint
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates great-circle distance between two points using the Haversine formula.
 */
export function calculateDistanceMeters(p1: LatLng, p2: LatLng): number {
  const dLat = toRadians(p2.lat - p1.lat);
  const dLng = toRadians(p2.lng - p1.lng);

  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates the forward azimuth / bearing between two points in degrees [0, 360).
 */
export function calculateBearing(start: LatLng, end: LatLng): number {
  const startLat = toRadians(start.lat);
  const startLng = toRadians(start.lng);
  const endLat = toRadians(end.lat);
  const endLng = toRadians(end.lng);

  const dLng = endLng - startLng;

  const y = Math.sin(dLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  let bearing = (toDegrees(Math.atan2(y, x)) + 360) % 360;
  return Math.round(bearing * 10) / 10;
}

/**
 * Determines whether a participant is within arrival radius of the destination.
 */
export function isWithinRadius(
  current: LatLng,
  target: LatLng,
  radiusMeters: number
): boolean {
  return calculateDistanceMeters(current, target) <= radiusMeters;
}

/**
 * Formats a distance in meters to a human-friendly string (e.g. "250 m" or "142.5 km").
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Formats duration in seconds to "Xh Ym" or "X min".
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return '1 min';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
