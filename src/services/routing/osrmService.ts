import { LatLng } from '@/utils/geoMath';
import { TravelMode } from '@/types/member';
import { RouteRecord, RouteStep } from '@/types/route';
import { CONFIG } from '@/constants/config';

function mapTravelModeToOsrmProfile(mode: TravelMode): string {
  switch (mode) {
    case 'BIKE':
      return 'bike';
    case 'WALK':
      return 'foot';
    case 'CAR':
    default:
      return 'driving';
  }
}

/**
 * Open Source Routing Machine (OSRM) client service.
 * Matches Section 7.5, 11.1, and 20.2 of Developer Handoff.
 */
export async function getRoute(
  origin: LatLng,
  destination: LatLng,
  travelMode: TravelMode = 'CAR',
  baseUrl: string = CONFIG.ROUTING.DEFAULT_OSRM_URL
): Promise<RouteRecord> {
  const profile = mapTravelModeToOsrmProfile(travelMode);
  // OSRM coordinates format: {lng},{lat};{lng},{lat}
  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${baseUrl}/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson&steps=true`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.ROUTING.TIMEOUT_MS);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found between coordinates.');
    }

    const osrmRoute = data.routes[0];
    const steps: RouteStep[] = [];

    if (osrmRoute.legs && osrmRoute.legs[0]?.steps) {
      for (const step of osrmRoute.legs[0].steps) {
        steps.push({
          distanceM: step.distance,
          durationS: step.duration,
          geometry: typeof step.geometry === 'string' ? step.geometry : '',
          name: step.name || 'Unnamed road',
          maneuver: {
            type: step.maneuver.type,
            modifier: step.maneuver.modifier,
            location: step.maneuver.location,
            instruction: step.maneuver.instruction || `${step.maneuver.type} ${step.maneuver.modifier || ''} on ${step.name || 'road'}`.trim(),
          },
        });
      }
    }

    return {
      routeVersion: 1,
      profile: travelMode,
      geometry: {
        type: 'LineString',
        coordinates: osrmRoute.geometry.coordinates,
      },
      distanceM: Math.round(osrmRoute.distance),
      durationS: Math.round(osrmRoute.duration),
      steps,
      updatedAt: Date.now(),
    };
  } catch (error: any) {
    console.warn('[OSRM Service] Routing request failed or offline, building geodesic corridor fallback:', error?.message);
    return createCorridorFallbackRoute(origin, destination, travelMode);
  }
}

/**
 * Creates an interpolated direct route corridor when offline or when OSRM is unreachable.
 * Ensures the app continues navigating seamlessly as specified in Section 11.4 & 12.
 */
export function createCorridorFallbackRoute(
  origin: LatLng,
  destination: LatLng,
  travelMode: TravelMode
): RouteRecord {
  const stepsCount = 10;
  const coordinates: Array<[number, number]> = [];

  for (let i = 0; i <= stepsCount; i++) {
    const fraction = i / stepsCount;
    const lng = origin.lng + (destination.lng - origin.lng) * fraction;
    const lat = origin.lat + (destination.lat - origin.lat) * fraction;
    coordinates.push([lng, lat]);
  }

  // Rough estimation: 60 km/h for car, 20 km/h for bike, 5 km/h for walk
  const speedMps = travelMode === 'CAR' ? 16.6 : travelMode === 'BIKE' ? 5.5 : 1.4;
  const dx = (destination.lng - origin.lng) * 111000;
  const dy = (destination.lat - origin.lat) * 111000;
  const distanceM = Math.round(Math.sqrt(dx * dx + dy * dy));
  const durationS = Math.round(distanceM / speedMps);

  const fallbackSteps: RouteStep[] = [
    {
      distanceM: Math.round(distanceM * 0.7),
      durationS: Math.round(durationS * 0.7),
      geometry: '',
      name: 'Highway corridor',
      maneuver: {
        type: 'depart',
        location: [origin.lng, origin.lat],
        instruction: 'Head toward destination on direct highway corridor',
      },
    },
    {
      distanceM: Math.round(distanceM * 0.3),
      durationS: Math.round(durationS * 0.3),
      geometry: '',
      name: 'Destination approach',
      maneuver: {
        type: 'arrive',
        location: [destination.lng, destination.lat],
        instruction: 'Arrive at destination',
      },
    },
  ];

  return {
    routeVersion: 1,
    profile: travelMode,
    geometry: {
      type: 'LineString',
      coordinates,
    },
    distanceM,
    durationS,
    steps: fallbackSteps,
    updatedAt: Date.now(),
  };
}
