import { TravelMode } from './member';

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface RouteManeuver {
  type: string;
  modifier?: string;
  location: [number, number]; // [lng, lat]
  instruction: string;
}

export interface RouteStep {
  distanceM: number;
  durationS: number;
  geometry: string; // encoded polyline
  name: string;
  maneuver: RouteManeuver;
}

/**
 * Where a route came from. `ESTIMATE` is a straight line drawn when no routing service could be
 * reached: it has no real roads or turns, and the UI must say so.
 */
export type RouteSource = 'ORS' | 'OSRM' | 'ESTIMATE';

/** A route as shared with the other travelers (compact, drawn on their maps). */
export interface SharedRoute {
  /** Encoded polyline (precision 5) of the simplified route. */
  polyline: string;
  distanceM: number;
  durationS: number;
  version: number;
  source: 'ORS' | 'OSRM';
  updatedAt: number;
}

export interface RouteRecord {
  source: RouteSource;
  routeVersion: number;
  profile: TravelMode;
  geometry: {
    type: 'LineString';
    coordinates: Array<[number, number]>; // [lng, lat]
  };
  distanceM: number;
  durationS: number;
  steps: RouteStep[];
  updatedAt: number;
}
