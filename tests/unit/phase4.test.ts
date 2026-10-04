import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { LocalStore } from '@/db/localStore';
import { SqlDatabase, SqlValue } from '@/db/sql';
import {
  MAX_OFFLINE_TILES,
  boundsFromPoints,
  estimateBytes,
  formatBytes,
  latToTileY,
  lngToTileX,
  padBounds,
  planZoomRange,
  tilesAtZoom,
  totalTiles,
} from '@/domain/tileMath';
import { LOW_BATTERY_PCT, diffLive, diffMembers, diffMeta } from '@/domain/journeyEvents';
import { calculateDistanceMeters, formatDistance, formatDuration, isWithinRadius } from '@/utils/geoMath';
import { computeTravelerSummary, simplifyPolylineRdp } from '@/utils/historyCompression';
import { JourneyMember } from '@/types/member';
import { JourneyMeta } from '@/types/journey';
import { LiveLocationRecord } from '@/types/liveLocation';
import { RouteRecord } from '@/types/route';

/** Real SQLite (Node's built-in engine) behind the same interface the app uses on the phone. */
function memoryDatabase(): SqlDatabase {
  const db = new DatabaseSync(':memory:');
  return {
    async run(sql: string, params: SqlValue[] = []) {
      db.prepare(sql).run(...params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as unknown as T[];
    },
  };
}

const route: RouteRecord = {
  source: 'ORS',
  routeVersion: 1,
  profile: 'CAR',
  geometry: { type: 'LineString', coordinates: [[77.2, 28.6], [75.8, 26.9]] },
  distanceM: 1000,
  durationS: 100,
  steps: [],
  updatedAt: 1,
};

describe('LocalStore (SQLite)', () => {
  it('migrates once and can be reopened safely', async () => {
    const db = memoryDatabase();
    const store = new LocalStore(db);
    await store.migrate();
    await store.migrate();
    await store.cacheRoute('j1', route);
    assert.equal((await new LocalStore(db).getCachedRoute('j1'))?.distanceM, 1000);
  });

  it('caches and replaces a journey route', async () => {
    const store = new LocalStore(memoryDatabase());
    await store.migrate();
    assert.equal(await store.getCachedRoute('nope'), null);
    await store.cacheRoute('j1', route);
    await store.cacheRoute('j1', { ...route, distanceM: 2222 });
    assert.equal((await store.getCachedRoute('j1'))?.distanceM, 2222);
  });

  it('records a track in order and keeps journeys separate', async () => {
    const store = new LocalStore(memoryDatabase());
    await store.migrate();
    await store.appendTrackPoint('a', { timestamp: 30, lat: 3, lng: 3, speedMps: 3 });
    await store.appendTrackPoint('a', { timestamp: 10, lat: 1, lng: 1, speedMps: 1 });
    await store.appendTrackPoint('b', { timestamp: 20, lat: 2, lng: 2, speedMps: 2 });
    assert.deepEqual((await store.getTrackPoints('a')).map((p) => p.timestamp), [10, 30]);
    await store.clearTrack('a');
    assert.equal((await store.getTrackPoints('a')).length, 0);
    assert.equal((await store.getTrackPoints('b')).length, 1);
  });

  it('holds chat typed offline until it is sent, in order', async () => {
    const store = new LocalStore(memoryDatabase());
    await store.migrate();
    const msg = (id: string, text: string) => ({
      id,
      senderUid: 'u',
      senderName: 'U',
      text,
      timestamp: 1,
      type: 'TEXT' as const,
    });
    await store.enqueueChat('j', msg('1', 'first'));
    await store.enqueueChat('j', msg('2', 'second'));
    await store.enqueueChat('other', msg('3', 'elsewhere'));
    assert.deepEqual((await store.getChatOutbox('j')).map((m) => m.text), ['first', 'second']);
    await store.removeChat('1');
    assert.deepEqual((await store.getChatOutbox('j')).map((m) => m.id), ['2']);
  });

  it('purges everything for a finished journey', async () => {
    const store = new LocalStore(memoryDatabase());
    await store.migrate();
    await store.cacheRoute('j', route);
    await store.appendTrackPoint('j', { timestamp: 1, lat: 1, lng: 1, speedMps: 0 });
    await store.purgeJourney('j');
    assert.equal(await store.getCachedRoute('j'), null);
    assert.equal((await store.getTrackPoints('j')).length, 0);
  });
});

describe('offline map region planning', () => {
  it('computes standard slippy-map tile coordinates', () => {
    assert.equal(lngToTileX(0, 1), 1);
    assert.equal(lngToTileX(-180, 3), 0);
    assert.equal(latToTileY(0, 1), 1);
    assert.equal(tilesAtZoom({ minLat: 28.5, maxLat: 28.7, minLng: 77.1, maxLng: 77.3 }, 0), 1);
  });

  it('keeps a long route under the tile cap by lowering detail', () => {
    const delhiToJaipur = padBounds(
      boundsFromPoints([{ lat: 28.61, lng: 77.2 }, { lat: 26.91, lng: 75.78 }])!,
      8
    );
    const plan = planZoomRange(delhiToJaipur);
    assert.ok(plan.tiles <= MAX_OFFLINE_TILES, `${plan.tiles} tiles`);
    assert.equal(plan.reducedDetail, true);
    assert.ok(plan.maxZoom >= 10);
    assert.equal(plan.tiles, totalTiles(delhiToJaipur, plan.minZoom, plan.maxZoom));
  });

  it('gives a short city trip full street-level detail', () => {
    const city = padBounds(
      boundsFromPoints([{ lat: 28.61, lng: 77.2 }, { lat: 28.64, lng: 77.23 }])!,
      2
    );
    const plan = planZoomRange(city);
    assert.equal(plan.maxZoom, 14);
    assert.equal(plan.reducedDetail, false);
  });

  it('pads and sizes sensibly', () => {
    const base = { minLat: 10, maxLat: 11, minLng: 70, maxLng: 71 };
    const padded = padBounds(base, 10);
    assert.ok(padded.minLat < 10 && padded.maxLat > 11 && padded.minLng < 70 && padded.maxLng > 71);
    assert.equal(boundsFromPoints([]), null);
    assert.equal(formatBytes(estimateBytes(1000)), '29.3 MB');
    assert.equal(formatBytes(512), '1 KB');
  });
});

describe('journey alerts', () => {
  const member = (uid: string, over: Partial<JourneyMember> = {}): JourneyMember => ({
    uid,
    name: uid.toUpperCase(),
    username: uid,
    phone: '1',
    seat: 0,
    origin: { kind: 'GPS', lat: null, lng: null, displayName: 'x' },
    travelMode: 'CAR',
    state: 'WAITING',
    joinedAt: 1,
    startedAt: null,
    finishedAt: null,
    ...over,
  });
  const live = (over: Partial<LiveLocationRecord> = {}): LiveLocationRecord => ({
    lat: 1,
    lng: 1,
    heading: 0,
    speedMps: 0,
    batteryPct: 80,
    status: 'ON_THE_WAY',
    lastUpdatedAt: 1,
    currentRoad: '',
    distanceRemainingM: 1,
    etaEpochMs: 1,
    routeVersion: 1,
    isSharing: true,
    ...over,
  });

  it('reports other travelers joining, starting, arriving and leaving - never yourself', () => {
    const prev = { me: member('me'), a: member('a') };
    const next = {
      me: member('me', { state: 'TRAVELING' }),
      a: member('a', { state: 'TRAVELING' }),
      b: member('b'),
    };
    const titles = diffMembers(prev, next, 'me').map((e) => e.message);
    assert.deepEqual(titles, ['A started their trip.', 'B joined the journey.']);
    assert.match(diffMembers(next, { me: next.me, a: member('a', { state: 'ARRIVED' }), b: next.b }, 'me')[0].message, /A has arrived/);
    assert.match(diffMembers(next, { me: next.me, b: next.b }, 'me')[0].message, /A left/);
  });

  it('announces a new host, and says "You" when it is you', () => {
    const members = { a: member('a'), me: member('me') };
    const meta = (creatorUid: string) => ({ creatorUid }) as JourneyMeta;
    assert.deepEqual(diffMeta(null, meta('a'), members, 'me'), []);
    assert.match(diffMeta(meta('a'), meta('me'), members, 'me')[0].message, /You are now the host/);
    assert.match(diffMeta(meta('me'), meta('a'), members, 'me')[0].message, /A is now the host/);
  });

  it('raises an urgent alert once when someone asks for help', () => {
    const members = { a: member('a', { state: 'TRAVELING' }) };
    const warned = new Set<string>();
    const first = diffLive({ a: live() }, { a: live({ status: 'NEED_HELP' }) }, members, 'me', warned);
    assert.equal(first[0].severity, 'urgent');
    const again = diffLive({ a: live({ status: 'NEED_HELP' }) }, { a: live({ status: 'NEED_HELP' }) }, members, 'me', warned);
    assert.equal(again.length, 0);
  });

  it('warns about low battery once per dip, not while charging, and again after recovery', () => {
    const members = { a: member('a', { state: 'TRAVELING' }) };
    const warned = new Set<string>();
    const low = live({ batteryPct: LOW_BATTERY_PCT });
    assert.equal(diffLive({}, { a: low }, members, 'me', warned).length, 1);
    assert.equal(diffLive({ a: low }, { a: live({ batteryPct: 10 }) }, members, 'me', warned).length, 0);
    diffLive({}, { a: live({ batteryPct: 60 }) }, members, 'me', warned); // recovered
    assert.equal(diffLive({}, { a: live({ batteryPct: 9 }) }, members, 'me', warned).length, 1);

    const chargingWarned = new Set<string>();
    assert.equal(
      diffLive({}, { a: live({ batteryPct: 5, charging: true }) }, members, 'me', chargingWarned).length,
      0
    );
  });
});

describe('geo + history helpers (real code)', () => {
  it('measures distance and radius', () => {
    const d = calculateDistanceMeters({ lat: 28.6139, lng: 77.209 }, { lat: 26.9124, lng: 75.7873 });
    assert.ok(d > 230_000 && d < 245_000);
    assert.equal(isWithinRadius({ lat: 1, lng: 1 }, { lat: 1, lng: 1.0001 }, 50), true);
    assert.equal(formatDistance(250), '250 m');
    assert.equal(formatDistance(142_500), '142.5 km');
    assert.equal(formatDuration(30), '1 min');
    assert.equal(formatDuration(3 * 3600 + 120), '3h 2m');
  });

  it('summarises a recorded track with real figures', () => {
    const points = [0, 1, 2, 3, 4].map((i) => ({
      timestamp: i * 60_000,
      lat: 28 + i * 0.01,
      lng: 77,
      speedMps: i === 3 ? 20 : 10,
    }));
    const summary = computeTravelerSummary(points, {
      uid: 'u',
      name: 'U',
      travelMode: 'CAR',
      startedAt: 0,
      finishedAt: 240_000,
    });
    assert.ok(summary.totalDistanceM > 4300 && summary.totalDistanceM < 4600);
    assert.equal(summary.durationS, 240);
    assert.equal(summary.maxSpeedKmh, 72);
    assert.ok(summary.avgSpeedKmh > 60 && summary.avgSpeedKmh < 70);
    assert.equal(summary.pointsSampleCount, 5);
  });

  it('simplifies a straight line to its end points', () => {
    const line: Array<[number, number]> = [0, 1, 2, 3, 4].map((i) => [77, 28 + i * 0.001]);
    assert.equal(simplifyPolylineRdp(line, 20).length, 2);
  });
});
