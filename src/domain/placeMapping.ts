import { Destination } from '@/types/journey';
import { OriginLocation } from '@/types/member';
import { PlaceResult } from '@/services/places/types';

/** "Wherever I am when I press Start". Stores no coordinates until a real GPS fix exists. */
export const CURRENT_LOCATION_ORIGIN: OriginLocation = {
  kind: 'GPS',
  lat: null,
  lng: null,
  displayName: 'My current location',
};

export type PickerTarget = 'destination' | 'origin';

/** What the place picker hands back. */
export type PickedPlace =
  | { type: 'CURRENT_LOCATION' }
  | { type: 'PLACE'; place: PlaceResult };

export function placeToDestination(place: PlaceResult): Destination {
  return {
    lat: place.lat,
    lng: place.lng,
    displayName: place.name,
    ...(place.address ? { address: place.address } : {}),
    ...(place.provider !== 'map' ? { placeId: place.id.slice(0, 100) } : {}),
  };
}

export function placeToOrigin(place: PlaceResult): OriginLocation {
  return {
    kind: place.provider === 'map' ? 'MAP' : 'PLACE',
    lat: place.lat,
    lng: place.lng,
    displayName: place.name,
  };
}

export function pickedToOrigin(picked: PickedPlace): OriginLocation {
  return picked.type === 'CURRENT_LOCATION' ? CURRENT_LOCATION_ORIGIN : placeToOrigin(picked.place);
}

/** Label for a dropped pin when reverse geocoding finds nothing. */
export function pinLabel(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function mapPinPlace(lat: number, lng: number, found: PlaceResult | null): PlaceResult {
  return {
    id: `map:${lat.toFixed(5)},${lng.toFixed(5)}`,
    name: found?.name ?? 'Dropped pin',
    address: found?.address ?? pinLabel(lat, lng),
    lat,
    lng,
    provider: 'map',
  };
}
