import { LatLng, calculateDistanceMeters } from '@/utils/geoMath';

export interface ArrivalFix extends LatLng {
  /** Horizontal accuracy in metres, if known. */
  accuracy?: number;
}

/**
 * Decides when a traveler has *really* arrived. A single noisy fix next to the destination
 * isn't enough: it needs several consecutive, reasonably accurate fixes inside the radius.
 * Fires once, then stays quiet until reset.
 */
export class ArrivalDetector {
  private consecutive = 0;
  private fired = false;

  constructor(
    private readonly radiusM: number,
    private readonly requiredFixes: number = 2,
    private readonly maxAccuracyM: number = 100
  ) {}

  /** Returns true exactly once: on the fix that confirms arrival. */
  update(fix: ArrivalFix, destination: LatLng): boolean {
    if (this.fired) return false;
    if (fix.accuracy !== undefined && fix.accuracy > this.maxAccuracyM) return false;

    if (calculateDistanceMeters(fix, destination) <= this.radiusM) {
      this.consecutive += 1;
      if (this.consecutive >= this.requiredFixes) {
        this.fired = true;
        return true;
      }
    } else {
      this.consecutive = 0;
    }
    return false;
  }

  get hasArrived(): boolean {
    return this.fired;
  }

  reset(): void {
    this.consecutive = 0;
    this.fired = false;
  }
}
