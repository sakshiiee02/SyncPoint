import { LatLng } from '@/utils/geoMath';
import { TravelMode } from '@/types/member';
import { RouteManeuver, RouteRecord, RouteStep } from '@/types/route';
import { FetchLike, RouteProvider, RoutingError } from './types';

const PROFILE: Record<TravelMode, string> = {
  CAR: 'driving-car',
  BIKE: 'cycling-regular',
  WALK: 'foot-walking',
};

/** ORS step type codes -> the manoeuvre vocabulary the navigation UI understands. */
const STEP_TYPES: Record<number, { type: string; modifier?: string }> = {
  0: { type: 'turn', modifier: 'left' },
  1: { type: 'turn', modifier: 'right' },
  2: { type: 'turn', modifier: 'sharp left' },
  3: { type: 'turn', modifier: 'sharp right' },
  4: { type: 'turn', modifier: 'slight left' },
  5: { type: 'turn', modifier: 'slight right' },
  6: { type: 'continue', modifier: 'straight' },
  7: { type: 'roundabout', modifier: 'right' },
  8: { type: 'roundabout', modifier: 'straight' },
  9: { type: 'turn', modifier: 'u-turn' },
  10: { type: 'arrive' },
  11: { type: 'depart' },
  12: { type: 'fork', modifier: 'slight left' },
  13: { type: 'fork', modifier: 'slight right' },
};

interface OrsStep {
  distance: number;
  duration: number;
  type: number;
  instruction: string;
  name?: string;
  way_points: [number, number];
}

/** Converts an ORS `directions/.../geojson` response into our RouteRecord. */
export function parseOrsResponse(json: any, mode: TravelMode): RouteRecord {
  const feature = json?.features?.[0];
  const coordinates: Array<[number, number]> | undefined = feature?.geometry?.coordinates?.map(
    (c: number[]) => [c[0], c[1]] as [number, number]
  );
  const summary = feature?.properties?.summary;
  if (!coordinates || coordinates.length < 2 || !summary) {
    throw new RoutingError('OpenRouteService returned no route.');
  }

  const steps: RouteStep[] = [];
  for (const segment of feature.properties.segments ?? []) {
    for (const step of (segment.steps ?? []) as OrsStep[]) {
      const kind = STEP_TYPES[step.type] ?? { type: 'continue', modifier: 'straight' };
      const at = coordinates[Math.min(step.way_points[0], coordinates.length - 1)];
      const maneuver: RouteManeuver = {
        type: kind.type,
        ...(kind.modifier ? { modifier: kind.modifier } : {}),
        location: at,
        instruction: step.instruction,
      };
      steps.push({
        distanceM: step.distance,
        durationS: step.duration,
        geometry: '',
        name: step.name && step.name !== '-' ? step.name : '',
        maneuver,
      });
    }
  }

  return {
    source: 'ORS',
    routeVersion: 1,
    profile: mode,
    geometry: { type: 'LineString', coordinates },
    distanceM: Math.round(summary.distance),
    durationS: Math.round(summary.duration),
    steps,
    updatedAt: Date.now(),
  };
}

export class OpenRouteServiceProvider implements RouteProvider {
  readonly name = 'ors' as const;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly fetchFn: FetchLike = fetch
  ) {}

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async getRoute(
    origin: LatLng,
    destination: LatLng,
    mode: TravelMode,
    signal?: AbortSignal
  ): Promise<RouteRecord> {
    const response = await this.fetchFn(`${this.baseUrl}/v2/directions/${PROFILE[mode]}/geojson`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json',
      },
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
        instructions: true,
        instructions_format: 'text',
        language: 'en',
        units: 'm',
      }),
    });

    if (!response.ok) {
      throw new RoutingError(`OpenRouteService error ${response.status}`, response.status);
    }
    return parseOrsResponse(await response.json(), mode);
  }
}
