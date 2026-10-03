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

export interface RouteRecord {
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
