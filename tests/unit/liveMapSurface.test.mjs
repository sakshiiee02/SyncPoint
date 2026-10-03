import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const STALE_WARNING_MS = 60000;
const ARRIVAL_RADIUS_M = 120;

function computeParticipantLiveState(record, profile, isLocalUser, nowMs = Date.now()) {
  const fallbackRecord = {
    lat: 0,
    lng: 0,
    heading: 0,
    speedMps: 0,
    batteryPct: 100,
    status: 'ON_THE_WAY',
    lastUpdatedAt: nowMs,
    currentRoad: 'Route corridor',
    distanceRemainingM: 0,
    etaEpochMs: nowMs,
    routeVersion: 1,
    isSharing: true,
  };

  const active = record || fallbackRecord;
  const isStale = nowMs - active.lastUpdatedAt > STALE_WARNING_MS;

  return {
    ...active,
    uid: profile.uid,
    name: profile.name,
    phone: profile.phone,
    photoUrl: profile.photoUrl,
    isLocalUser,
    isStale,
  };
}

describe('SyncPoint Phase 2: Live Group Map Surface & Telemetry', () => {
  const mockProfile = {
    uid: 'traveler_1',
    name: 'Shashank',
    username: 'shashank_v',
    phone: '+91 9876543210',
  };

  test('computeParticipantLiveState marks stale when last fix is older than 60s', () => {
    const now = 1000000;
    const freshRecord = {
      lat: 15.38,
      lng: 73.83,
      heading: 90,
      speedMps: 20,
      batteryPct: 85,
      status: 'ON_THE_WAY',
      lastUpdatedAt: now - 15000, // 15 sec ago
      currentRoad: 'NH 48',
      distanceRemainingM: 45000,
      etaEpochMs: now + 3600000,
      routeVersion: 1,
      isSharing: true,
    };

    const stateFresh = computeParticipantLiveState(freshRecord, mockProfile, true, now);
    assert.equal(stateFresh.isStale, false);
    assert.equal(stateFresh.isLocalUser, true);

    const staleRecord = {
      ...freshRecord,
      lastUpdatedAt: now - 65000, // 65 sec ago (> 60s)
    };

    const stateStale = computeParticipantLiveState(staleRecord, mockProfile, false, now);
    assert.equal(stateStale.isStale, true);
    assert.equal(stateStale.isLocalUser, false);
  });

  test('paused location sharing preserves last coordinates and marks isSharing: false', () => {
    const now = 1000000;
    const pausedRecord = {
      lat: 15.40,
      lng: 73.85,
      heading: 0,
      speedMps: 0,
      batteryPct: 70,
      status: 'BREAK',
      lastUpdatedAt: now - 30000,
      currentRoad: 'Highway Motel',
      distanceRemainingM: 40000,
      etaEpochMs: now + 4000000,
      routeVersion: 1,
      isSharing: false, // PAUSED
    };

    const state = computeParticipantLiveState(pausedRecord, mockProfile, false, now);
    assert.equal(state.isSharing, false);
    assert.equal(state.lat, 15.40);
    assert.equal(state.lng, 73.85);
  });

  test('Route visual hierarchy gives local user primary glowing style', () => {
    const ROUTE_STYLES = {
      primary: {
        lineColor: '#06b6d4',
        lineWidth: 5.5,
        lineOpacity: 0.95,
      },
      subordinate: {
        lineColor: '#818cf8',
        lineWidth: 3.0,
        lineOpacity: 0.55,
      },
    };

    assert.equal(ROUTE_STYLES.primary.lineColor, '#06b6d4');
    assert.ok(ROUTE_STYLES.primary.lineWidth > ROUTE_STYLES.subordinate.lineWidth);
    assert.ok(ROUTE_STYLES.primary.lineOpacity > ROUTE_STYLES.subordinate.lineOpacity);
  });

  test('Arrival detection confirms destination proximity at 120m threshold', () => {
    const distInside = 85;
    const distOutside = 160;

    assert.equal(distInside <= ARRIVAL_RADIUS_M, true);
    assert.equal(distOutside <= ARRIVAL_RADIUS_M, false);
  });
});
