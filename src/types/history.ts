import { TravelMode } from './member';

export interface HistoryPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speedMps: number;
}

export interface TravelerHistoryRecord {
  uid: string;
  name: string;
  travelMode: TravelMode;
  startedAt: number;
  finishedAt: number;
  totalDistanceM: number;
  durationS: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  compressedPolyline: Array<[number, number]>; // GeoJSON [lng, lat]
  pointsSampleCount: number;
}

export interface JourneyHistorySnapshot {
  journeyId: string;
  name: string;
  destination: {
    lat: number;
    lng: number;
    displayName: string;
  };
  createdAt: number;
  completedAt: number;
  status: 'COMPLETED' | 'EXPIRED';
  travelers: Record<string, TravelerHistoryRecord>;
}

export interface RecentJourneySummary {
  journeyId: string;
  name: string;
  destinationName: string;
  completedAt: number;
  status: 'COMPLETED' | 'EXPIRED';
  totalTravelers: number;
}
