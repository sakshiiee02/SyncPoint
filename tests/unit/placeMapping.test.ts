import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_LOCATION_ORIGIN,
  mapPinPlace,
  pickedToOrigin,
  placeToDestination,
  placeToOrigin,
} from '@/domain/placeMapping';
import { PlaceResult } from '@/services/places/types';

const airport: PlaceResult = {
  id: 'geoapify-123',
  name: 'Goa International Airport',
  address: 'Dabolim, Goa, India',
  lat: 15.3808,
  lng: 73.8314,
  provider: 'geoapify',
};

describe('place mapping', () => {
  it('turns a searched place into a destination', () => {
    assert.deepEqual(placeToDestination(airport), {
      lat: 15.3808,
      lng: 73.8314,
      displayName: 'Goa International Airport',
      address: 'Dabolim, Goa, India',
      placeId: 'geoapify-123',
    });
  });

  it('"current location" is a GPS origin with no invented coordinates', () => {
    const origin = pickedToOrigin({ type: 'CURRENT_LOCATION' });
    assert.deepEqual(origin, CURRENT_LOCATION_ORIGIN);
    assert.equal(origin.kind, 'GPS');
    assert.equal(origin.lat, null);
    assert.equal(origin.lng, null);
  });

  it('searched places are PLACE origins and dropped pins are MAP origins', () => {
    assert.equal(placeToOrigin(airport).kind, 'PLACE');
    const pin = mapPinPlace(26.91234, 75.78731, null);
    assert.equal(pin.provider, 'map');
    assert.equal(pin.name, 'Dropped pin');
    assert.equal(pin.address, '26.91234, 75.78731');
    assert.equal(placeToOrigin(pin).kind, 'MAP');
    assert.equal('placeId' in placeToDestination(pin), false);
  });

  it('a pin keeps the reverse-geocoded address when one was found', () => {
    const pin = mapPinPlace(15.38, 73.83, airport);
    assert.equal(pin.name, 'Goa International Airport');
    assert.equal(pin.lat, 15.38); // but at the exact pin location, not the place's own coordinates
  });
});
