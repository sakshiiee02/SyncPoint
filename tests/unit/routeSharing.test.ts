import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decodePolyline, encodePolyline } from '@/domain/polyline';
import {
  MAX_SHARED_POLYLINE_CHARS,
  TRAVELER_ROUTE_COLORS,
  routeColorFor,
  sharedRouteCoordinates,
  toSharedRoute,
} from '@/domain/routeSharing';
import { RouteRecord } from '@/types/route';
import { calculateDistanceMeters } from '@/utils/geoMath';

const route = (coordinates: Array<[number, number]>, source: RouteRecord['source'] = 'ORS'): RouteRecord => ({
  source,
  routeVersion: 3,
  profile: 'CAR',
  geometry: { type: 'LineString', coordinates },
  distanceM: 310_000,
  durationS: 11_700,
  steps: [],
  updatedAt: 0,
});

/** A wiggly road: a long diagonal with a sine wobble, many points. */
const winding = (points: number): Array<[number, number]> =>
  Array.from({ length: points }, (_, i) => [
    77.2 - (i / points) * 1.4 + Math.sin(i / 7) * 0.01,
    28.6 - (i / points) * 1.7 + Math.cos(i / 9) * 0.01,
  ]);

describe('polyline encoding', () => {
  it('matches the published reference example', () => {
    // Google's documented example: (38.5,-120.2) (40.7,-120.95) (43.252,-126.453)
    const encoded = encodePolyline([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
    assert.equal(encoded, '_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    assert.deepEqual(decodePolyline(encoded), [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
  });

  it('round-trips to within a metre, including negative coordinates', () => {
    const original = winding(500);
    const decoded = decodePolyline(encodePolyline(original));
    assert.equal(decoded.length, original.length);
    for (let i = 0; i < original.length; i += 50) {
      const d = calculateDistanceMeters(
        { lat: original[i][1], lng: original[i][0] },
        { lat: decoded[i][1], lng: decoded[i][0] }
      );
      assert.ok(d < 1.5, `point ${i} off by ${d} m`);
    }
    assert.deepEqual(decodePolyline(''), []);
  });
});

describe('route sharing', () => {
  it('shrinks a long route a lot while keeping its shape', () => {
    const original = route(winding(4000));
    const shared = toSharedRoute(original);
    const coords = sharedRouteCoordinates(shared);
    assert.ok(coords.length < 2000, `${coords.length} points kept`);
    assert.ok(shared.polyline.length < 20_000, `${shared.polyline.length} chars`);
    assert.equal(shared.distanceM, 310_000);
    assert.equal(shared.version, 3);
    assert.deepEqual(coords[0].map((n) => Math.round(n * 1e4)), original.geometry.coordinates[0].map((n) => Math.round(n * 1e4)));
    const last = original.geometry.coordinates[3999];
    assert.ok(calculateDistanceMeters({ lat: coords[coords.length - 1][1], lng: coords[coords.length - 1][0] }, { lat: last[1], lng: last[0] }) < 2);
  });

  it('always fits the size the database rules allow', () => {
    // A pathological zig-zag that cannot be simplified much.
    const zigzag: Array<[number, number]> = Array.from({ length: 30_000 }, (_, i) => [
      77 + (i % 2) * 0.01 + i * 1e-5,
      28 + ((i * 7919) % 1000) * 1e-4,
    ]);
    const shared = toSharedRoute(route(zigzag));
    assert.ok(shared.polyline.length <= MAX_SHARED_POLYLINE_CHARS);
    assert.ok(shared.polyline.length < 100_000);
  });

  it('gives each seat a stable colour, wrapping after ten', () => {
    assert.equal(routeColorFor(0), TRAVELER_ROUTE_COLORS[0]);
    assert.equal(routeColorFor(3), routeColorFor(13));
    assert.equal(new Set(TRAVELER_ROUTE_COLORS).size, 10);
  });
});
