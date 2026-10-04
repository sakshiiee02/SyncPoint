import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { indexRoute, projectOntoRoute } from '@/domain/routeProgress';
import { PaceTracker, estimateEtaEpochMs } from '@/domain/eta';
import { ArrivalDetector } from '@/domain/arrival';
import { buildParticipantViews, SelfTelemetry } from '@/domain/participantView';
import { evaluateNavigationProgress } from '@/services/routing/navigationEngine';
import { calculateDistanceMeters } from '@/utils/geoMath';
import { RouteRecord } from '@/types/route';
import { JourneyMember } from '@/types/member';
import { LiveLocationRecord } from '@/types/liveLocation';

// An L-shaped route: ~11 km north, then ~11 km east. Straight-line start→end is only ~15.7 km.
const NORTH: [number, number] = [77.0, 28.1];
const CORNER: [number, number] = [77.0, 28.2];
const EAST: [number, number] = [77.113, 28.2];
const START: [number, number] = [77.0, 28.0];

const route: RouteRecord = {
  source: 'OSRM',
  routeVersion: 1,
  profile: 'CAR',
  geometry: { type: 'LineString', coordinates: [START, NORTH, CORNER, EAST] },
  distanceM: 22000,
  durationS: 1600,
  steps: [
    {
      distanceM: 22200,
      durationS: 1000,
      geometry: '',
      name: 'NH 48',
      maneuver: { type: 'depart', location: START, instruction: 'Head north on NH 48' },
    },
    {
      distanceM: 11000,
      durationS: 600,
      geometry: '',
      name: 'Ring Road',
      maneuver: { type: 'turn', modifier: 'right', location: CORNER, instruction: 'Turn right onto Ring Road' },
    },
    {
      distanceM: 0,
      durationS: 0,
      geometry: '',
      name: 'Ring Road',
      maneuver: { type: 'arrive', location: EAST, instruction: 'Arrive at destination' },
    },
  ],
  updatedAt: 0,
};

const ll = (c: [number, number]) => ({ lat: c[1], lng: c[0] });

describe('route progress', () => {
  it('measures distance along the road, not in a straight line', () => {
    const index = indexRoute(route.geometry.coordinates);
    const atStart = projectOntoRoute(index, ll(START));
    assert.ok(atStart.crossTrackM < 1);
    const straight = calculateDistanceMeters(ll(START), ll(EAST));
    const alongRoute = index.totalM - atStart.alongM;
    assert.ok(alongRoute > straight * 1.25, `route ${alongRoute} should exceed straight ${straight}`);
  });

  it('reports remaining distance shrinking as the traveler advances, and off-route when away', () => {
    const atStart = evaluateNavigationProgress(ll(START), route);
    const midway = evaluateNavigationProgress(ll(CORNER), route, atStart.segmentIndex);
    assert.ok(midway.distanceRemainingM < atStart.distanceRemainingM / 1.5);
    assert.equal(atStart.isOffRoute, false);

    const lost = evaluateNavigationProgress({ lat: 28.1, lng: 77.05 }, route);
    assert.equal(lost.isOffRoute, true);
  });

  it('picks the right manoeuvre and road for the current position', () => {
    const early = evaluateNavigationProgress({ lat: 28.05, lng: 77.0 }, route);
    assert.equal(early.currentRoad, 'NH 48');
    assert.match(early.instruction, /Turn right/);
    assert.equal(early.maneuverIcon, '↱');
    assert.ok(early.distanceToNextManeuverM > 16000 && early.distanceToNextManeuverM < 17500);

    const late = evaluateNavigationProgress({ lat: 28.2, lng: 77.06 }, route);
    assert.equal(late.currentRoad, 'Ring Road');
    assert.match(late.instruction, /Arrive/);
  });
});

describe('ETA', () => {
  const planner = { distanceM: 20000, durationS: 2000 }; // 10 m/s
  const base = { remainingM: 10000, route: planner, travelMode: 'CAR' as const, nowMs: 1_000_000 };

  it('uses the planner speed when the traveler has no pace yet', () => {
    assert.equal(estimateEtaEpochMs({ ...base, recentPaceMps: null }), 1_000_000 + 1_000_000);
  });

  it('blends in real pace but stays within 0.5x-1.5x of the planner', () => {
    const slow = estimateEtaEpochMs({ ...base, recentPaceMps: 0.1 });
    assert.equal(slow, 1_000_000 + 2_000_000); // clamped to 5 m/s
    const fast = estimateEtaEpochMs({ ...base, recentPaceMps: 100 });
    assert.equal(Math.round((fast - 1_000_000) / 1000), 667); // clamped to 15 m/s
  });

  it('is "now" when nothing remains, and falls back to mode defaults without a route', () => {
    assert.equal(estimateEtaEpochMs({ ...base, remainingM: 0, recentPaceMps: null }), 1_000_000);
    const walk = estimateEtaEpochMs({ remainingM: 1300, route: null, recentPaceMps: null, travelMode: 'WALK', nowMs: 0 });
    assert.equal(walk, 1_000_000);
  });

  it('PaceTracker ignores stops', () => {
    const pace = new PaceTracker();
    pace.push(0);
    assert.equal(pace.averageMps, null);
    pace.push(10);
    pace.push(0.2);
    assert.equal(pace.averageMps, 10);
  });
});

describe('arrival detection', () => {
  const dest = { lat: 15.38, lng: 73.83 };
  const near = { lat: 15.3805, lng: 73.8305, accuracy: 10 };
  const far = { lat: 15.5, lng: 73.9, accuracy: 10 };

  it('needs consecutive accurate fixes inside the radius, and fires once', () => {
    const detector = new ArrivalDetector(120, 2, 100);
    assert.equal(detector.update(near, dest), false); // first fix is not enough
    assert.equal(detector.update(near, dest), true);
    assert.equal(detector.update(near, dest), false);
    assert.equal(detector.hasArrived, true);
  });

  it('resets the streak when the traveler leaves, and ignores inaccurate fixes', () => {
    const detector = new ArrivalDetector(120, 2, 100);
    detector.update(near, dest);
    detector.update(far, dest);
    assert.equal(detector.update(near, dest), false);
    assert.equal(detector.update({ ...near, accuracy: 500 }, dest), false);
    assert.equal(detector.update(near, dest), true);
  });
});

describe('participant views (roster/map model)', () => {
  const member = (uid: string, over: Partial<JourneyMember> = {}): JourneyMember => ({
    uid,
    name: uid,
    username: uid,
    phone: '1',
    seat: 0,
    origin: { kind: 'PLACE', lat: 26.9, lng: 75.8, displayName: 'Jaipur' },
    travelMode: 'CAR',
    state: 'WAITING',
    joinedAt: 1,
    startedAt: null,
    finishedAt: null,
    ...over,
  });
  const live = (over: Partial<LiveLocationRecord> = {}): LiveLocationRecord => ({
    lat: 20,
    lng: 75,
    heading: 90,
    speedMps: 12,
    batteryPct: 63,
    charging: false,
    status: 'ON_THE_WAY',
    lastUpdatedAt: 1000,
    currentRoad: 'NH 48',
    distanceRemainingM: 5000,
    etaEpochMs: 9999,
    routeVersion: 1,
    isSharing: true,
    ...over,
  });
  const noSelf: SelfTelemetry = {
    fix: null,
    batteryPct: null,
    charging: false,
    distanceRemainingM: null,
    etaEpochMs: null,
    currentRoad: '',
    status: 'ON_THE_WAY',
  };
  const views = (members: Record<string, JourneyMember>, locations = {}, self = noSelf, selfUid = 'me') =>
    buildParticipantViews({ members, locations, selfUid, self, nowMs: 5000, staleMs: 60_000 });

  it('REGRESSION: a friend who has not started has no distance/ETA and is never "arrived"', () => {
    const [friend] = views({ f: member('f') });
    assert.equal(friend.travelerState, 'WAITING');
    assert.equal(friend.distanceRemainingM, null);
    assert.equal(friend.etaEpochMs, null);
    assert.equal(friend.batteryPct, null);
    assert.equal(friend.positionKind, 'ORIGIN'); // dimmed at their chosen start
    assert.equal(friend.isSharing, false);
  });

  it('shows no position at all for a waiting friend with a GPS origin that has no fix yet', () => {
    const [friend] = views({
      f: member('f', { origin: { kind: 'GPS', lat: null, lng: null, displayName: 'My current location' } }),
    });
    assert.equal(friend.positionKind, 'NONE');
  });

  it('uses live data and real battery for travelers', () => {
    const [p] = views({ t: member('t', { state: 'TRAVELING' }) }, { t: live() });
    assert.equal(p.positionKind, 'LIVE');
    assert.equal(p.batteryPct, 63);
    assert.equal(p.distanceRemainingM, 5000);
  });

  it('marks an overdue traveler stale but a paused one paused, not stale', () => {
    const stale = views({ t: member('t', { state: 'TRAVELING' }) }, { t: live({ lastUpdatedAt: 1 }) }, noSelf)[0];
    const old = buildParticipantViews({
      members: { t: member('t', { state: 'TRAVELING' }) },
      locations: { t: live({ lastUpdatedAt: 1 }) },
      selfUid: 'me',
      self: noSelf,
      nowMs: 200_000,
      staleMs: 60_000,
    })[0];
    assert.equal(stale.isStale, false);
    assert.equal(old.isStale, true);

    const paused = buildParticipantViews({
      members: { t: member('t', { state: 'PAUSED' }) },
      locations: { t: live({ lastUpdatedAt: 1, isSharing: false }) },
      selfUid: 'me',
      self: noSelf,
      nowMs: 200_000,
      staleMs: 60_000,
    })[0];
    assert.equal(paused.isSharing, false);
    assert.equal(paused.isStale, false);
  });

  it('prefers this device\'s own fix and battery for the local traveler', () => {
    const [me] = views(
      { me: member('me', { state: 'TRAVELING' }) },
      { me: live({ batteryPct: 10, lat: 1, lng: 1 }) },
      {
        fix: { lat: 21, lng: 76, speedMps: 3, heading: 10 },
        batteryPct: 88,
        charging: true,
        distanceRemainingM: 4200,
        etaEpochMs: 7777,
        currentRoad: 'Ring Road',
        status: 'FUEL_STOP',
      }
    );
    assert.equal(me.lat, 21);
    assert.equal(me.batteryPct, 88);
    assert.equal(me.charging, true);
    assert.equal(me.status, 'FUEL_STOP');
    assert.equal(me.isStale, false);
  });

  it('arrived travelers show 0 remaining; finished ones show no live data', () => {
    const [arrived] = views({ a: member('a', { state: 'ARRIVED' }) }, { a: live() });
    assert.equal(arrived.distanceRemainingM, 0);
    const [done] = views({ d: member('d', { state: 'FINISHED' }) });
    assert.equal(done.positionKind, 'NONE');
    assert.equal(done.distanceRemainingM, null);
  });
});
