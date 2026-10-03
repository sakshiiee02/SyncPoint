export type JourneyStatus = 'LOBBY' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface Destination {
  lat: number;
  lng: number;
  placeId?: string;
  displayName: string;
  address?: string;
}

export interface JourneyMeta {
  journeyId: string;
  name: string;
  status: JourneyStatus;
  creatorUid: string;
  createdAt: number;
  startedAt: number | null;
  expiresAt: number;
  memberCount: number;
  destination: Destination;
}

export interface JoinCodeRecord {
  code: string;
  journeyId: string;
  expiresAt: number;
  status: 'ACTIVE' | 'EXPIRED';
}

export interface ActiveJourneyByUser {
  journeyId: string;
  startedAt: number;
  expiresAt: number;
}
