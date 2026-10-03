import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

function interpolateStep(current, target, speedMps, intervalMs) {
  const dLat = target.lat - current.lat;
  const dLng = target.lng - current.lng;
  const totalM = Math.sqrt(dLat * dLat + dLng * dLng) * 111000; // rough meter conversion

  if (totalM < 25) {
    return { lat: target.lat, lng: target.lng, speedMps: 0, arrived: true };
  }

  const stepDistanceM = speedMps * (intervalMs / 1000);
  const fraction = Math.min(stepDistanceM / totalM, 1.0);

  return {
    lat: current.lat + dLat * fraction,
    lng: current.lng + dLng * fraction,
    speedMps,
    arrived: false,
  };
}

describe('SyncPoint Phase 3: Movement Simulator Engine', () => {
  const START = { lat: 28.6139, lng: 77.2090 }; // Delhi
  const TARGET = { lat: 15.3808, lng: 73.8314 }; // Goa Airport

  test('interpolateStep moves vehicle forward toward destination', () => {
    const step1 = interpolateStep(START, TARGET, 22.2, 2000); // 80 km/h for 2 sec
    assert.equal(step1.arrived, false);
    assert.ok(step1.lat < START.lat, 'Latitude should decrease heading South toward Goa');
    assert.ok(step1.lng < START.lng, 'Longitude should decrease heading West toward Goa');
  });

  test('interpolateStep stops vehicle upon arrival within 25m threshold', () => {
    const closePoint = { lat: 15.38081, lng: 73.83141 }; // ~1 meter away from Goa
    const stepArrived = interpolateStep(closePoint, TARGET, 20, 2000);
    assert.equal(stepArrived.arrived, true);
    assert.equal(stepArrived.speedMps, 0);
  });
});
