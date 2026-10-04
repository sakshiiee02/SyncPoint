import { LatLng } from '@/utils/geoMath';
import { TravelMode } from '@/types/member';
import { RouteRecord } from '@/types/route';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface RouteProvider {
  /** Name used for quota accounting and logs. */
  readonly name: 'ors' | 'osrm';
  /** False when the provider can't be used at all (e.g. no API key configured). */
  readonly isConfigured: boolean;
  getRoute(origin: LatLng, destination: LatLng, mode: TravelMode, signal?: AbortSignal): Promise<RouteRecord>;
}

export class RoutingError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'RoutingError';
  }
}
