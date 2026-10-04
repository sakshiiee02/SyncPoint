import { ref, set, onValue, off, DataSnapshot, serverTimestamp } from 'firebase/database';
import { getFirebaseDb } from './firebaseApp';
import { LiveLocationRecord } from '@/types/liveLocation';
import { SharedRoute } from '@/types/route';
import { stripUndefined } from '@/data/serialization';
import { Paths } from '@/data/paths';

/**
 * Publishes this traveler's latest position and telemetry. `lastUpdatedAt` is stamped by the
 * Firebase server, so "last seen 20 s ago" is right even if a phone's clock is wrong.
 */
export async function publishLiveLocation(
  journeyId: string,
  uid: string,
  record: LiveLocationRecord
): Promise<void> {
  const db = getFirebaseDb();
  await set(ref(db, Paths.liveOf(journeyId, uid)), {
    ...stripUndefined(record),
    lastUpdatedAt: serverTimestamp(),
  });
}

/** Everyone's live positions in the journey (members only, enforced by rules). */
export function subscribeToLiveLocations(
  journeyId: string,
  onLocationsUpdate: (locations: Record<string, LiveLocationRecord>) => void
): () => void {
  const livePathRef = ref(getFirebaseDb(), Paths.live(journeyId));

  const callback = (snapshot: DataSnapshot) => {
    onLocationsUpdate(snapshot.exists() ? (snapshot.val() as Record<string, LiveLocationRecord>) : {});
  };

  onValue(livePathRef, callback, () => onLocationsUpdate({}));
  return () => off(livePathRef, 'value', callback);
}

/** Shares this traveler's route so friends can see where they are heading. */
export async function publishSharedRoute(
  journeyId: string,
  uid: string,
  route: SharedRoute
): Promise<void> {
  await set(ref(getFirebaseDb(), Paths.routeOf(journeyId, uid)), {
    ...route,
    updatedAt: serverTimestamp(),
  });
}

/** Everyone's shared routes (members only, enforced by rules). */
export function subscribeToSharedRoutes(
  journeyId: string,
  onRoutes: (routes: Record<string, SharedRoute>) => void
): () => void {
  const routesRef = ref(getFirebaseDb(), Paths.routes(journeyId));
  const callback = (snapshot: DataSnapshot) => {
    onRoutes(snapshot.exists() ? (snapshot.val() as Record<string, SharedRoute>) : {});
  };
  onValue(routesRef, callback, () => onRoutes({}));
  return () => off(routesRef, 'value', callback);
}
