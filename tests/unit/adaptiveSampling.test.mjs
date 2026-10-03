import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const CONFIG = {
  FAST_INTERVAL_MS: 2500,
  NORMAL_INTERVAL_MS: 5000,
  SLOW_INTERVAL_MS: 8000,
  STATIONARY_INTERVAL_MS: 25000,
  MIN_PUBLISH_DISTANCE_M: 30,
  MIN_FAST_PUBLISH_MS: 1500,
  HEADING_CHANGE_THRESHOLD_DEG: 25,
};

function determineMotionState(speedMps) {
  if (speedMps > 13.88) return 'FAST'; // > 50 km/h
  if (speedMps > 4.16) return 'NORMAL'; // 15 - 50 km/h
  if (speedMps > 0.83) return 'SLOW'; // 3 - 15 km/h
  return 'STATIONARY'; // < 3 km/h
}

function getTargetIntervalMs(state) {
  switch (state) {
    case 'FAST': return CONFIG.FAST_INTERVAL_MS;
    case 'NORMAL': return CONFIG.NORMAL_INTERVAL_MS;
    case 'SLOW': return CONFIG.SLOW_INTERVAL_MS;
    case 'STATIONARY':
    default: return CONFIG.STATIONARY_INTERVAL_MS;
  }
}

class TestAdaptiveSampler {
  constructor() {
    this.lastPublishedTimeMs = 0;
    this.lastHeading = 0;
  }

  shouldPublish(elapsedMs, speedMps, distanceMovedM, headingDelta = 0) {
    if (this.lastPublishedTimeMs === 0) {
      this.lastPublishedTimeMs = 1;
      return true;
    }

    const state = determineMotionState(speedMps);
    const targetIntervalMs = getTargetIntervalMs(state);

    if (elapsedMs >= targetIntervalMs) return true;
    if (distanceMovedM >= CONFIG.MIN_PUBLISH_DISTANCE_M && elapsedMs >= CONFIG.MIN_FAST_PUBLISH_MS) return true;
    if (state !== 'STATIONARY' && headingDelta >= CONFIG.HEADING_CHANGE_THRESHOLD_DEG && elapsedMs >= CONFIG.MIN_FAST_PUBLISH_MS) return true;

    return false;
  }
}

describe('SyncPoint Phase 3: Adaptive Location Sampling Policy', () => {
  test('determineMotionState classifies vehicle velocity bands correctly', () => {
    assert.equal(determineMotionState(22.2), 'FAST'); // 80 km/h
    assert.equal(determineMotionState(10.0), 'NORMAL'); // 36 km/h
    assert.equal(determineMotionState(2.5), 'SLOW'); // 9 km/h
    assert.equal(determineMotionState(0.2), 'STATIONARY'); // 0.7 km/h
  });

  test('Fast highway driving triggers publication every 2.5 seconds', () => {
    const sampler = new TestAdaptiveSampler();
    sampler.shouldPublish(0, 22.2, 0); // initial fix

    assert.equal(sampler.shouldPublish(1000, 22.2, 10), false);
    assert.equal(sampler.shouldPublish(2500, 22.2, 10), true);
  });

  test('Stationary vehicle suppresses high-frequency heartbeat up to 25 seconds', () => {
    const sampler = new TestAdaptiveSampler();
    sampler.shouldPublish(0, 0, 0); // initial fix

    assert.equal(sampler.shouldPublish(3000, 0, 0), false);
    assert.equal(sampler.shouldPublish(10000, 0, 0), false);
    assert.equal(sampler.shouldPublish(20000, 0, 0), false);
    assert.equal(sampler.shouldPublish(25000, 0, 0), true);
  });

  test('Significant distance jump (>=30m) triggers publish after minimum throttle', () => {
    const sampler = new TestAdaptiveSampler();
    sampler.shouldPublish(0, 10.0, 0);

    // Moved 35m in 1600ms (city turn or sudden acceleration)
    assert.equal(sampler.shouldPublish(1600, 10.0, 35), true);
    // Moved 35m but under 1500ms (too fast)
    assert.equal(sampler.shouldPublish(800, 10.0, 35), false);
  });

  test('Significant heading change (>=25 deg) forces route turn update', () => {
    const sampler = new TestAdaptiveSampler();
    sampler.shouldPublish(0, 12.0, 0);

    // 45 degree turn onto new road
    assert.equal(sampler.shouldPublish(1600, 12.0, 10, 45), true);
    // Slight 10 degree road curve
    assert.equal(sampler.shouldPublish(1600, 12.0, 10, 10), false);
  });
});
