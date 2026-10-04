import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenRouteServiceProvider, parseOrsResponse } from '@/services/routing/providers/openRouteService';
import { OsrmProvider, parseOsrmResponse } from '@/services/routing/providers/osrm';
import { RouteProvider } from '@/services/routing/providers/types';
import { RouteService, createEstimatedRoute } from '@/services/routing/routeService';
import { buildInstruction } from '@/services/routing/instructions';
import { getManeuverIcon } from '@/services/routing/navigationEngine';
import { QuotaGuard } from '@/services/storage/quotaGuard';
import { MemoryStore } from '@/services/storage/keyValueStore';
import { RouteRecord } from '@/types/route';

const A = { lat: 28.6, lng: 77.2 };
const B = { lat: 26.9, lng: 75.8 };

const orsJson = {
  features: [
    {
      geometry: { coordinates: [[77.2, 28.6], [77.1, 28.4], [76.0, 27.0], [75.8, 26.9]] },
      properties: {
        summary: { distance: 280400.4, duration: 17000.2 },
        segments: [
          {
            steps: [
              { distance: 1000, duration: 90, type: 11, instruction: 'Head south on Ring Road', name: 'Ring Road', way_points: [0, 1] },
              { distance: 270000, duration: 16000, type: 1, instruction: 'Turn right onto NH 48', name: 'NH 48', way_points: [1, 2] },
              { distance: 0, duration: 0, type: 10, instruction: 'Arrive at your destination', name: '-', way_points: [3, 3] },
            ],
          },
        ],
      },
    },
  ],
};

const osrmJson = {
  routes: [
    {
      distance: 5000.4,
      duration: 400.2,
      geometry: { coordinates: [[77.2, 28.6], [77.21, 28.61]] },
      legs: [
        {
          steps: [
            { distance: 3000, duration: 200, name: 'MG Road', maneuver: { type: 'depart', location: [77.2, 28.6] } },
            { distance: 2000, duration: 200, name: 'Ring Road', maneuver: { type: 'turn', modifier: 'left', location: [77.205, 28.605] } },
            { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive', location: [77.21, 28.61] } },
          ],
        },
      ],
    },
  ],
};

const fakeRoute = (source: RouteRecord['source']): RouteRecord => ({
  source,
  routeVersion: 1,
  profile: 'CAR',
  geometry: { type: 'LineString', coordinates: [[77.2, 28.6], [75.8, 26.9]] },
  distanceM: 1000,
  durationS: 100,
  steps: [],
  updatedAt: 0,
});

function fakeProvider(name: 'ors' | 'osrm', behaviour: 'ok' | 'fail', configured = true) {
  const state = { calls: 0 };
  const provider: RouteProvider = {
    name,
    isConfigured: configured,
    async getRoute() {
      state.calls++;
      if (behaviour === 'fail') throw new Error(`${name} down`);
      return fakeRoute(name === 'ors' ? 'ORS' : 'OSRM');
    },
  };
  return { provider, state };
}

const quota = (limits: Record<string, number> = { ors: 100, osrm: 100 }) =>
  new QuotaGuard(new MemoryStore(), limits);

describe('OpenRouteService parsing', () => {
  it('maps geometry, totals and manoeuvres', () => {
    const route = parseOrsResponse(orsJson, 'CAR');
    assert.equal(route.source, 'ORS');
    assert.equal(route.distanceM, 280400);
    assert.equal(route.geometry.coordinates.length, 4);
    assert.equal(route.steps.length, 3);
    assert.equal(route.steps[0].maneuver.type, 'depart');
    assert.equal(route.steps[1].maneuver.modifier, 'right');
    assert.deepEqual(route.steps[1].maneuver.location, [77.1, 28.4]); // start of that step
    assert.equal(route.steps[2].maneuver.type, 'arrive');
    assert.equal(route.steps[2].name, ''); // ORS "-" means unnamed
    assert.equal(getManeuverIcon(route.steps[1].maneuver.type, route.steps[1].maneuver.modifier), '↱');
  });

  it('rejects an empty response', () => {
    assert.throws(() => parseOrsResponse({ features: [] }, 'CAR'), /no route/i);
  });

  it('sends the right profile, key and coordinates', async () => {
    let seen: { url: string; init: any } | null = null;
    const provider = new OpenRouteServiceProvider('KEY123', 'https://ors.test', async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify(orsJson), { status: 200 });
    });
    await provider.getRoute(A, B, 'BIKE');
    assert.equal(seen!.url, 'https://ors.test/v2/directions/cycling-regular/geojson');
    assert.equal(seen!.init.headers.Authorization, 'KEY123');
    assert.deepEqual(JSON.parse(seen!.init.body).coordinates, [[77.2, 28.6], [75.8, 26.9]]);
    await provider.getRoute(A, B, 'WALK');
    assert.match(seen!.url, /foot-walking/);
  });

  it('is unconfigured without a key and surfaces HTTP errors', async () => {
    assert.equal(new OpenRouteServiceProvider('', 'x').isConfigured, false);
    const provider = new OpenRouteServiceProvider('k', 'https://ors.test', async () =>
      new Response('quota', { status: 403 })
    );
    await assert.rejects(provider.getRoute(A, B, 'CAR'), /403/);
  });
});

describe('OSRM parsing', () => {
  it('builds readable instructions from type/modifier/road', () => {
    const route = parseOsrmResponse(osrmJson, 'WALK');
    assert.equal(route.source, 'OSRM');
    assert.equal(route.steps[0].maneuver.instruction, 'Head out on MG Road');
    assert.equal(route.steps[1].maneuver.instruction, 'Turn left onto Ring Road');
    assert.match(route.steps[2].maneuver.instruction, /arrived/);
    assert.equal(buildInstruction('turn', 'uturn', 'X'), 'Make a U-turn on X');
  });

  it('uses the per-profile public server', async () => {
    let url = '';
    const provider = new OsrmProvider(
      { CAR: 'https://car.test', BIKE: 'https://bike.test', WALK: 'https://foot.test' },
      async (u) => {
        url = u;
        return new Response(JSON.stringify(osrmJson), { status: 200 });
      }
    );
    await provider.getRoute(A, B, 'BIKE');
    assert.match(url, /^https:\/\/bike\.test\/route\/v1\/driving\/77\.2,28\.6;75\.8,26\.9/);
  });
});

describe('RouteService', () => {
  it('prefers the first configured provider and caches the result', async () => {
    const ors = fakeProvider('ors', 'ok');
    const osrm = fakeProvider('osrm', 'ok');
    const service = new RouteService([ors.provider, osrm.provider], quota());
    const first = await service.getRoute(A, B, 'CAR');
    const second = await service.getRoute(A, B, 'CAR');
    assert.equal(first.source, 'ORS');
    assert.equal(second, first);
    assert.equal(ors.state.calls, 1);
    assert.equal(osrm.state.calls, 0);
    await service.getRoute(A, B, 'CAR', { fresh: true });
    assert.equal(ors.state.calls, 2);
  });

  it('falls back to the next provider when one fails or is not configured', async () => {
    const down = fakeProvider('ors', 'fail');
    const osrm = fakeProvider('osrm', 'ok');
    const viaFallback = await new RouteService([down.provider, osrm.provider], quota()).getRoute(A, B, 'CAR');
    assert.equal(viaFallback.source, 'OSRM');

    const unconfigured = fakeProvider('ors', 'ok', false);
    const skipped = await new RouteService([unconfigured.provider, osrm.provider], quota()).getRoute(B, A, 'CAR');
    assert.equal(skipped.source, 'OSRM');
    assert.equal(unconfigured.state.calls, 0);
  });

  it('respects the daily quota', async () => {
    const ors = fakeProvider('ors', 'ok');
    const osrm = fakeProvider('osrm', 'ok');
    const service = new RouteService([ors.provider, osrm.provider], quota({ ors: 1, osrm: 100 }));
    assert.equal((await service.getRoute(A, B, 'CAR', { fresh: true })).source, 'ORS');
    assert.equal((await service.getRoute(A, B, 'CAR', { fresh: true })).source, 'OSRM');
  });

  it('returns a clearly labelled estimate instead of failing when everything is down', async () => {
    const service = new RouteService(
      [fakeProvider('ors', 'fail').provider, fakeProvider('osrm', 'fail').provider],
      quota()
    );
    const route = await service.getRoute(A, B, 'CAR', { destinationName: 'Jaipur' });
    assert.equal(route.source, 'ESTIMATE');
    assert.equal(route.geometry.coordinates.length, 2);
    assert.match(route.steps[0].maneuver.instruction, /Jaipur/);
    assert.ok(route.distanceM > 200_000);
  });

  it('estimates by travel mode', () => {
    const car = createEstimatedRoute(A, B, 'CAR');
    const walk = createEstimatedRoute(A, B, 'WALK');
    assert.ok(walk.durationS > car.durationS * 5);
  });
});

describe('QuotaGuard', () => {
  it('counts per day and per provider', async () => {
    let now = Date.parse('2026-10-04T10:00:00Z');
    const guard = new QuotaGuard(new MemoryStore(), { a: 2 }, () => now);
    assert.equal(await guard.tryConsume('a'), true);
    assert.equal(await guard.tryConsume('a'), true);
    assert.equal(await guard.tryConsume('a'), false);
    assert.equal(await guard.tryConsume('unlimited'), true);
    now = Date.parse('2026-10-05T00:01:00Z'); // new day
    assert.equal(await guard.tryConsume('a'), true);
    assert.equal(await guard.used('a'), 1);
  });
});
