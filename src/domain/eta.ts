import { TravelMode } from '@/types/member';

/** Typical cruising speeds, only used when a route gives no usable average. */
const DEFAULT_SPEED_MPS: Record<TravelMode, number> = {
  CAR: 13.9, // ~50 km/h
  BIKE: 4.5, // ~16 km/h
  WALK: 1.3, // ~4.7 km/h
};

/** Speeds below this are treated as "stopped" and ignored when learning the traveler's pace. */
const MOVING_THRESHOLD_MPS = 1.0;

/**
 * Tracks a smoothed pace from recent GPS speeds so one slow or fast moment doesn't swing the ETA.
 */
export class PaceTracker {
  private ema: number | null = null;

  constructor(private readonly alpha: number = 0.15) {}

  push(speedMps: number): void {
    if (!Number.isFinite(speedMps) || speedMps < MOVING_THRESHOLD_MPS) return;
    this.ema = this.ema === null ? speedMps : this.alpha * speedMps + (1 - this.alpha) * this.ema;
  }

  get averageMps(): number | null {
    return this.ema;
  }

  reset(): void {
    this.ema = null;
  }
}

export interface EtaInput {
  remainingM: number;
  route: { distanceM: number; durationS: number } | null;
  recentPaceMps: number | null;
  travelMode: TravelMode;
  nowMs: number;
}

/**
 * ETA from the distance left *along the route*, at a speed blended from what the route planner
 * expects and how the traveler is actually moving (kept within 0.5x-1.5x of the planner's speed,
 * so stopping for fuel doesn't produce an absurd ETA).
 */
export function estimateEtaEpochMs(input: EtaInput): number {
  const { remainingM, route, recentPaceMps, travelMode, nowMs } = input;
  if (remainingM <= 0) return nowMs;

  const plannerSpeed =
    route && route.durationS > 0 && route.distanceM > 0
      ? route.distanceM / route.durationS
      : DEFAULT_SPEED_MPS[travelMode];

  let speed = plannerSpeed;
  if (recentPaceMps !== null) {
    const blended = 0.6 * recentPaceMps + 0.4 * plannerSpeed;
    speed = Math.min(plannerSpeed * 1.5, Math.max(plannerSpeed * 0.5, blended));
  }
  return nowMs + Math.round((remainingM / speed) * 1000);
}
