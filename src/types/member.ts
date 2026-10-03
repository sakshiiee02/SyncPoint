export type MemberRole = 'CREATOR' | 'MEMBER';

export type TravelMode = 'CAR' | 'BIKE' | 'WALK';

export type SharingState =
  | 'NOT_STARTED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'ARRIVED'
  | 'FINISHED'
  | 'LEFT';

export interface OriginLocation {
  lat: number;
  lng: number;
  displayName: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  username: string;
  phone: string;
  photoUrl?: string;
}

export interface JourneyMember extends UserProfile {
  role: MemberRole;
  origin: OriginLocation;
  travelMode: TravelMode;
  sharingState: SharingState;
  joinedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}
