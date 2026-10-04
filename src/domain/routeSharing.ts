import { RouteRecord, SharedRoute } from '@/types/route';
import { simplifyPolylineRdp } from '@/utils/historyCompression';
import { decodePolyline, encodePolyline } from './polyline';

/** Stay well under the 100,000-character limit enforced by the database rules. */
export const MAX_SHARED_POLYLINE_CHARS = 60_000;

/**
 * Compact form of a route for other travelers to draw: the line is simplified to within ~25 m
 * (invisible on a map) and encoded as a polyline string. If a very long route is still too big,
 * the simplification is relaxed until it fits.
 */
export function toSharedRoute(route: RouteRecord): SharedRoute {
  let epsilon = 25;
  let polyline = '';
  for (let attempt = 0; attempt < 8; attempt++) {
    polyline = encodePolyline(simplifyPolylineRdp(route.geometry.coordinates, epsilon));
    if (polyline.length <= MAX_SHARED_POLYLINE_CHARS) break;
    epsilon *= 2;
  }
  return {
    polyline,
    distanceM: route.distanceM,
    durationS: route.durationS,
    version: route.routeVersion,
    source: route.source === 'ESTIMATE' ? 'ORS' : route.source,
    updatedAt: Date.now(),
  };
}

export function sharedRouteCoordinates(shared: SharedRoute): Array<[number, number]> {
  return decodePolyline(shared.polyline);
}

/** Distinct, readable line colours for other travelers (the local traveler's route is always blue). */
export const TRAVELER_ROUTE_COLORS = [
  '#e11d48',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#4f46e5',
  '#0d9488',
  '#78716c',
];

/** Stable colour per traveler: the same person keeps the same colour on every phone. */
export function routeColorFor(seat: number): string {
  return TRAVELER_ROUTE_COLORS[seat % TRAVELER_ROUTE_COLORS.length];
}
