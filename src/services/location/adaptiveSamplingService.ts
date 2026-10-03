import { MotionState } from '@/types/liveLocation';
import { calculateDistanceMeters } from '@/utils/geoMath';
import { CONFIG } from '@/constants/config';

/**
 * TypeScript implementation of AdaptiveSamplingPolicy mirroring Android Kotlin engine.
 * Gates high-frequency GPS fixes before sending them to Firebase Realtime Database.
 * Matches Section 8.4 and Section 32 of Developer Handoff.
 */
export class AdaptiveSamplingService {
  private lastPublishedTimeMs = 0;
  private lastPublishedLat = 0;
  private lastPublishedLng = 0;
  private lastPublishedHeading = 0;

  determineMotionState(speedMps: number): MotionState {
    if (speedMps > 13.88) return 'FAST'; // > 50 km/h
    if (speedMps > 4.16) return 'NORMAL'; // 15 - 50 km/h
    if (speedMps > 0.83) return 'SLOW'; // 3 - 15 km/h
    return 'STATIONARY'; // < 3 km/h
  }

  getTargetIntervalMs(state: MotionState): number {
    switch (state) {
      case 'FAST':
        return CONFIG.SAMPLING.FAST_INTERVAL_MS; // 2500 ms
      case 'NORMAL':
        return CONFIG.SAMPLING.NORMAL_INTERVAL_MS; // 5000 ms
      case 'SLOW':
        return CONFIG.SAMPLING.SLOW_INTERVAL_MS; // 8000 ms
      case 'STATIONARY':
      default:
        return CONFIG.SAMPLING.STATIONARY_INTERVAL_MS; // 25000 ms
    }
  }

  shouldPublish(
    lat: number,
    lng: number,
    speedMps: number,
    heading: number,
    currentTimeMs: number = Date.now()
  ): boolean {
    if (this.lastPublishedTimeMs === 0) {
      this.recordPublish(currentTimeMs, lat, lng, heading);
      return true;
    }

    const elapsedMs = currentTimeMs - this.lastPublishedTimeMs;
    const motionState = this.determineMotionState(speedMps);
    const targetIntervalMs = this.getTargetIntervalMs(motionState);

    // 1. Time interval elapsed
    if (elapsedMs >= targetIntervalMs) {
      this.recordPublish(currentTimeMs, lat, lng, heading);
      return true;
    }

    // 2. Significant distance delta moved
    const distanceMovedM = calculateDistanceMeters(
      { lat: this.lastPublishedLat, lng: this.lastPublishedLng },
      { lat, lng }
    );

    if (
      distanceMovedM >= CONFIG.SAMPLING.MIN_PUBLISH_DISTANCE_M &&
      elapsedMs >= CONFIG.SAMPLING.MIN_FAST_PUBLISH_MS
    ) {
      this.recordPublish(currentTimeMs, lat, lng, heading);
      return true;
    }

    // 3. Significant heading delta while moving
    if (motionState !== 'STATIONARY' && elapsedMs >= CONFIG.SAMPLING.MIN_FAST_PUBLISH_MS) {
      const headingDelta = Math.abs(heading - this.lastPublishedHeading);
      const normalizedDelta = headingDelta > 180 ? 360 - headingDelta : headingDelta;
      if (normalizedDelta >= CONFIG.SAMPLING.HEADING_CHANGE_THRESHOLD_DEG) {
        this.recordPublish(currentTimeMs, lat, lng, heading);
        return true;
      }
    }

    return false;
  }

  private recordPublish(timeMs: number, lat: number, lng: number, heading: number) {
    this.lastPublishedTimeMs = timeMs;
    this.lastPublishedLat = lat;
    this.lastPublishedLng = lng;
    this.lastPublishedHeading = heading;
  }

  reset() {
    this.lastPublishedTimeMs = 0;
    this.lastPublishedLat = 0;
    this.lastPublishedLng = 0;
    this.lastPublishedHeading = 0;
  }
}

export const adaptiveSampler = new AdaptiveSamplingService();
