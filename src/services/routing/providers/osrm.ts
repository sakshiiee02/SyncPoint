import { LatLng } from '@/utils/geoMath';
import { TravelMode } from '@/types/member';
import { RouteRecord, RouteStep } from '@/types/route';
import { buildInstruction } from '../instructions';
import { FetchLike, RouteProvider, RoutingError } from './types';

/** Converts an OSRM `route/v1` response (geometries=geojson, steps=true) into our RouteRecord. */
export function parseOsrmResponse(json: any, mode: TravelMode): RouteRecord {
  const route = json?.routes?.[0];
  const coordinates: Array<[number, number]> | undefined = route?.geometry?.coordinates;
  if (!route || !coordinates || coordinates.length < 2) {
    throw new RoutingError('No route found between these points.');
  }

  const steps: RouteStep[] = [];
  for (const step of route.legs?.[0]?.steps ?? []) {
    const roadName = step.name || '';
    steps.push({
      distanceM: step.distance,
      durationS: step.duration,
      geometry: '',
      name: roadName,
      maneuver: {
        type: step.maneuver.type,
        modifier: step.maneuver.modifier,
        location: step.maneuver.location,
        instruction: buildInstruction(step.maneuver.type, step.maneuver.modifier, roadName),
      },
    });
  }

  return {
    source: 'OSRM',
    routeVersion: 1,
    profile: mode,
    geometry: { type: 'LineString', coordinates },
    distanceM: Math.round(route.distance),
    durationS: Math.round(route.duration),
    steps,
    updatedAt: Date.now(),
  };
}

/**
 * Public OSRM service run by the OpenStreetMap community (FOSSGIS): one server per profile,
 * free and keyless but fair-use only — so it is the fallback, never the first choice.
 * (These servers expect the literal profile name "driving" in the path whatever the vehicle.)
 */
export class OsrmProvider implements RouteProvider {
  readonly name = 'osrm' as const;
  readonly isConfigured = true;

  constructor(
    private readonly baseUrls: Record<TravelMode, string>,
    private readonly fetchFn: FetchLike = fetch
  ) {}

  async getRoute(
    origin: LatLng,
    destination: LatLng,
    mode: TravelMode,
    signal?: AbortSignal
  ): Promise<RouteRecord> {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${this.baseUrls[mode]}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
    const response = await this.fetchFn(url, { signal });
    if (!response.ok) throw new RoutingError(`OSRM error ${response.status}`, response.status);
    return parseOsrmResponse(await response.json(), mode);
  }
}
