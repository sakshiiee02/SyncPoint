import { ref, set, onValue, off, DataSnapshot } from 'firebase/database';
import { getFirebaseDb } from './firebaseApp';
import { LiveLocationRecord } from '@/types/liveLocation';

/**
 * Publishes the latest live position and vehicle telemetry for a participant.
 * Matches Section 9.4 and Section 10 of Developer Handoff.
 */
export async function publishLiveLocation(
  journeyId: string,
  uid: string,
  record: LiveLocationRecord
): Promise<void> {
  const db = getFirebaseDb();
  const liveRef = ref(db, `journeys/${journeyId}/live/${uid}`);
  await set(liveRef, record);
}

/**
 * Subscribes to high-frequency live location updates for all active travelers in the journey.
 */
export function subscribeToLiveLocations(
  journeyId: string,
  onLocationsUpdate: (locations: Record<string, LiveLocationRecord>) => void
): () => void {
  const db = getFirebaseDb();
  const livePathRef = ref(db, `journeys/${journeyId}/live`);

  const callback = (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      onLocationsUpdate(snapshot.val() as Record<string, LiveLocationRecord>);
    } else {
      onLocationsUpdate({});
    }
  };

  onValue(livePathRef, callback);

  return () => {
    off(livePathRef, 'value', callback);
  };
}

/**
 * Pauses live tracking publication for a participant while preserving their last known position.
 * Matches Section 8.5 & Section 22: "Pause retains the last known location and timestamp
 * but must not keep publishing new coordinates."
 */
export async function setLocationSharingPaused(
  journeyId: string,
  uid: string,
  lastKnown: LiveLocationRecord,
  isPaused: boolean
): Promise<void> {
  const db = getFirebaseDb();
  const liveRef = ref(db, `journeys/${journeyId}/live/${uid}`);
  await set(liveRef, {
    ...lastKnown,
    isSharing: !isPaused,
    lastUpdatedAt: Date.now(),
  });
}
