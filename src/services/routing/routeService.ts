import { CONFIG } from '@/constants/config';
import { QuotaGuard } from '@/services/storage/quotaGuard';
import { LatLng, calculateDistanceMeters } from '@/utils/geoMath';
import { TravelMode } from '@/types/member';
import { RouteRecord } from '@/types/route';
import { RouteProvider } from './providers/types';

export interface GetRouteOptions {
  /** Skip the cache (used for re-routing after leaving the route). */
  fresh?: boolean;
  destinationName?: string;
}

/** Typical speeds for an estimate when there is no real route (m/s). */
const ESTIMATE_SPEED_MPS: Record<TravelMode, number> = { CAR: 13.9, BIKE: 4.5, WALK: 1.3 };

/**
 * A straight line from A to B. It is NOT a road route: it has no turns, so it is labelled
 * `source: 'ESTIMATE'` and the UI says so. Better than failing, never presented as real.
 */
export function createEstimatedRoute(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  destinationName = 'your destination'
): RouteRecord {
  const distanceM = Math.round(calculateDistanceMeters(origin, destination));
  const durationS = Math.round(distanceM / ESTIMATE_SPEED_MPS[mode]);
  const start: [number, number] = [origin.lng, origin.lat];
  const end: [number, number] = [destination.lng, destination.lat];
  return {
    source: 'ESTIMATE',
    routeVersion: 1,
    profile: mode,
    geometry: { type: 'LineString', coordinates: [start, end] },
    distanceM,
    durationS,
    steps: [
      {
        distanceM,
        durationS,
        geometry: '',
        name: '',
        maneuver: {
          type: 'depart',
          location: start,
          instruction: `Head toward ${destinationName}`,
        },
      },
      {
        distanceM: 0,
        durationS: 0,
        geometry: '',
        name: '',
        maneuver: { type: 'arrive', location: end, instruction: `Arrive at ${destinationName}` },
      },
    ],
    updatedAt: Date.now(),
  };
}

const round = (n: number, places: number) => n.toFixed(places);

export class RouteService {
  private cache = new Map<string, { route: RouteRecord; at: number }>();

  constructor(
    private readonly providers: RouteProvider[],
    private readonly quota: QuotaGuard,
    private readonly cacheTtlMs: number = CONFIG.ROUTING.ROUTE_CACHE_TTL_MS,
    private readonly timeoutMs: number = CONFIG.ROUTING.TIMEOUT_MS,
    private readonly now: () => number = Date.now
  ) {}

  private cacheKey(o: LatLng, d: LatLng, mode: TravelMode): string {
    return `${mode}:${round(o.lat, 3)},${round(o.lng, 3)}>${round(d.lat, 4)},${round(d.lng, 4)}`;
  }

  /**
   * Best available route: cache → each configured provider in order (within its daily share) →
   * labelled straight-line estimate. Never throws, so navigation can always continue.
   */
  async getRoute(
    origin: LatLng,
    destination: LatLng,
    mode: TravelMode,
    options: GetRouteOptions = {}
  ): Promise<RouteRecord> {
    const key = this.cacheKey(origin, destination, mode);
    const cached = this.cache.get(key);
    if (!options.fresh && cached && this.now() - cached.at < this.cacheTtlMs) return cached.route;

    for (const provider of this.providers) {
      if (!provider.isConfigured) continue;
      if (!(await this.quota.tryConsume(provider.name))) continue;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const route = await provider.getRoute(origin, destination, mode, controller.signal);
        this.cache.set(key, { route, at: this.now() });
        return route;
      } catch (error) {
        console.warn(`[Routing] ${provider.name} failed:`, (error as Error)?.message);
      } finally {
        clearTimeout(timer);
      }
    }
    return createEstimatedRoute(origin, destination, mode, options.destinationName);
  }
}
