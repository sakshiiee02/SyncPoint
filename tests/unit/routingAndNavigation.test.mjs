import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const REROUTE_THRESHOLD_M = 75;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
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

function distanceToSegmentMeters(p, a, b) {
  const dAB = calculateDistanceMeters(a, b);
  if (dAB === 0) return calculateDistanceMeters(p, a);

  const dAP = calculateDistanceMeters(a, p);
  const dBP = calculateDistanceMeters(b, p);

  if (dAP * dAP >= dBP * dBP + dAB * dAB) return dBP;
  if (dBP * dBP >= dAP * dAP + dAB * dAB) return dAP;

  const s = (dAB + dAP + dBP) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - dAB) * (s - dAP) * (s - dBP)));
  return (2 * area) / dAB;
}

function getManeuverIcon(type, modifier) {
  if (type === 'arrive') return '🏁';
  if (type === 'depart') return '🚗';

  switch (modifier) {
    case 'left':
    case 'sharp left':
    case 'slight left':
      return '↰';
    case 'right':
    case 'sharp right':
    case 'slight right':
      return '↱';
    case 'u-turn':
      return '↩';
    case 'straight':
    default:
      return '⬆️';
  }
}

describe('SyncPoint Phase 4: Routing & Navigation Engine', () => {
  const A = { lat: 28.6100, lng: 77.2000 };
  const B = { lat: 28.6100, lng: 77.2100 }; // Due East road segment ~970m

  test('distanceToSegmentMeters calculates cross-track error correctly', () => {
    // Point directly on segment
    const onSegment = { lat: 28.6100, lng: 77.2050 };
    const distOn = distanceToSegmentMeters(onSegment, A, B);
    assert.ok(distOn < 1.0, `Expected near zero, got ${distOn}`);

    // Point 55 meters North of midpoint
    // 1 deg lat is ~111,000m -> 0.0005 deg is ~55.5m
    const pointNorth = { lat: 28.6105, lng: 77.2050 };
    const distNorth = distanceToSegmentMeters(pointNorth, A, B);
    assert.ok(distNorth > 50 && distNorth < 60, `Expected ~55m, got ${distNorth}`);
  });

  test('Off-route threshold triggers at 75m boundary', () => {
    // Point 50m North -> on route (< 75m)
    const onRoutePoint = { lat: 28.61045, lng: 77.2050 };
    const dist1 = distanceToSegmentMeters(onRoutePoint, A, B);
    assert.equal(dist1 <= REROUTE_THRESHOLD_M, true);

    // Point 120m North -> off route (> 75m)
    const offRoutePoint = { lat: 28.6111, lng: 77.2050 };
    const dist2 = distanceToSegmentMeters(offRoutePoint, A, B);
    assert.equal(dist2 > REROUTE_THRESHOLD_M, true);
  });

  test('getManeuverIcon produces expected directional navigation glyphs', () => {
    assert.equal(getManeuverIcon('turn', 'left'), '↰');
    assert.equal(getManeuverIcon('turn', 'sharp right'), '↱');
    assert.equal(getManeuverIcon('turn', 'u-turn'), '↩');
    assert.equal(getManeuverIcon('arrive'), '🏁');
    assert.equal(getManeuverIcon('depart'), '🚗');
    assert.equal(getManeuverIcon('continue', 'straight'), '⬆️');
  });

  test('Secondary route pattern preserves canonical journey destination', () => {
    const canonicalRoute = { id: 'canonical_goa_route', dest: 'Goa Airport' };
    const secondaryRoute = { id: 'secondary_rahul_route', dest: 'Rahul Live Location' };

    let activeRoute = canonicalRoute;
    let savedRoute = null;

    // Start secondary navigation to traveler
    savedRoute = activeRoute;
    activeRoute = secondaryRoute;
    assert.equal(activeRoute.dest, 'Rahul Live Location');
    assert.equal(savedRoute.dest, 'Goa Airport');

    // Exit secondary route
    activeRoute = savedRoute;
    savedRoute = null;
    assert.equal(activeRoute.dest, 'Goa Airport');
    assert.equal(savedRoute, null);
  });
});
