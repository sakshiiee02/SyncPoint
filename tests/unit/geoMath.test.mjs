import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Test implementation mirror for Node native ESM test runner
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function calculateDistanceMeters(p1, p2) {
  const EARTH_RADIUS_METERS = 6371000;
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

function calculateBearing(start, end) {
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

function isWithinRadius(current, target, radiusMeters) {
  return calculateDistanceMeters(current, target) <= radiusMeters;
}

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

function formatDuration(seconds) {
  if (seconds < 60) return '1 min';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

function formatRecency(timestampMs, nowMs = Date.now()) {
  const diffSeconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

describe('SyncPoint Geodesic & Navigation Math', () => {
  const GOA_AIRPORT = { lat: 15.3808, lng: 73.8314 };
  const DELHI = { lat: 28.6139, lng: 77.2090 };
  const JAIPUR = { lat: 26.9124, lng: 75.7873 };

  test('calculateDistanceMeters computes accurate great-circle distance', () => {
    const distDelhiGoa = calculateDistanceMeters(DELHI, GOA_AIRPORT);
    // Delhi to Goa Airport is approx 1500 km (+/- 30km)
    assert.ok(distDelhiGoa > 1450000 && distDelhiGoa < 1550000, `Expected ~1500km, got ${distDelhiGoa}`);

    const distJaipurGoa = calculateDistanceMeters(JAIPUR, GOA_AIRPORT);
    assert.ok(distJaipurGoa > 1250000 && distJaipurGoa < 1350000, `Expected ~1300km, got ${distJaipurGoa}`);
  });

  test('calculateBearing calculates directional azimuth correctly', () => {
    // Due North
    const p1 = { lat: 10.0, lng: 70.0 };
    const pNorth = { lat: 11.0, lng: 70.0 };
    const bearingNorth = calculateBearing(p1, pNorth);
    assert.equal(bearingNorth, 0);

    // Due East
    const pEast = { lat: 10.0, lng: 71.0 };
    const bearingEast = calculateBearing(p1, pEast);
    assert.ok(Math.abs(bearingEast - 90) < 0.5, `Expected 90, got ${bearingEast}`);
  });

  test('isWithinRadius detects arrival at 120m threshold', () => {
    // Point 50m away from Goa Airport
    const nearGoa = { lat: 15.3808, lng: 73.8318 };
    const dist = calculateDistanceMeters(nearGoa, GOA_AIRPORT);
    assert.ok(dist < 120, `Distance should be under 120m, was ${dist}`);
    assert.equal(isWithinRadius(nearGoa, GOA_AIRPORT, 120), true);

    // Point 500m away
    const farGoa = { lat: 15.3850, lng: 73.8350 };
    assert.equal(isWithinRadius(farGoa, GOA_AIRPORT, 120), false);
  });

  test('formatDistance formats meters and kilometers appropriately', () => {
    assert.equal(formatDistance(85), '85 m');
    assert.equal(formatDistance(999), '999 m');
    assert.equal(formatDistance(142500), '142.5 km');
  });

  test('formatDuration formats minutes and hours cleanly', () => {
    assert.equal(formatDuration(45), '1 min');
    assert.equal(formatDuration(1800), '30 min');
    assert.equal(formatDuration(8100), '2h 15m');
  });

  test('formatRecency outputs friendly timestamps', () => {
    const now = 1000000;
    assert.equal(formatRecency(now - 2000, now), 'just now');
    assert.equal(formatRecency(now - 25000, now), '25s ago');
    assert.equal(formatRecency(now - 180000, now), '3m ago');
    assert.equal(formatRecency(now - 7200000, now), '2h ago');
  });
});
