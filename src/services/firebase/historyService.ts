import { ref, set, get, onValue, off, DataSnapshot } from 'firebase/database';
import { getFirebaseDb } from './firebaseApp';
import { TravelerHistoryRecord, JourneyHistorySnapshot, RecentJourneySummary } from '@/types/history';

/**
 * Persists a traveler's completed journey history to Firebase RTDB.
 * Matches Section 13 & 16 of Developer Handoff.
 * Path: /journeys/{journeyId}/history/{uid}
 */
export async function saveParticipantHistory(
  journeyId: string,
  record: TravelerHistoryRecord
): Promise<void> {
  const db = getFirebaseDb();
  const historyRef = ref(db, `journeys/${journeyId}/history/${record.uid}`);
  await set(historyRef, record);
}

/**
 * Retrieves the complete multi-traveler historical record for a journey.
 */
export async function getJourneyHistory(
  journeyId: string
): Promise<JourneyHistorySnapshot | null> {
  const db = getFirebaseDb();

  const [metaSnap, historySnap] = await Promise.all([
    get(ref(db, `journeys/${journeyId}/meta`)),
    get(ref(db, `journeys/${journeyId}/history`)),
  ]);

  if (!metaSnap.exists()) {
    return null;
  }

  const meta = metaSnap.val();
  const travelers: Record<string, TravelerHistoryRecord> = historySnap.exists()
    ? historySnap.val()
    : {};

  return {
    journeyId,
    name: meta.name || 'Road Trip',
    destination: meta.destination || { lat: 0, lng: 0, displayName: 'Destination' },
    createdAt: meta.createdAt || Date.now(),
    completedAt: meta.expiresAt || Date.now(),
    status: meta.status === 'EXPIRED' ? 'EXPIRED' : 'COMPLETED',
    travelers,
  };
}

/**
 * Subscribes to real-time updates for journey history.
 */
export function subscribeToJourneyHistory(
  journeyId: string,
  onUpdate: (snapshot: JourneyHistorySnapshot | null) => void
): () => void {
  const db = getFirebaseDb();
  const historyRef = ref(db, `journeys/${journeyId}/history`);

  const callback = async (snapshot: DataSnapshot) => {
    const fullSnapshot = await getJourneyHistory(journeyId);
    if (fullSnapshot) {
      if (snapshot.exists()) {
        fullSnapshot.travelers = snapshot.val();
      }
      onUpdate(fullSnapshot);
    } else {
      onUpdate(null);
    }
  };

  onValue(historyRef, callback);

  return () => {
    off(historyRef, 'value', callback);
  };
}

/**
 * Fetches recent journey history summaries for display on the home screen.
 */
export async function listRecentJourneys(): Promise<RecentJourneySummary[]> {
  const db = getFirebaseDb();
  try {
    const journeysSnap = await get(ref(db, 'journeys'));
    if (!journeysSnap.exists()) {
      return [];
    }

    const allJourneys = journeysSnap.val() as Record<string, any>;
    const summaries: RecentJourneySummary[] = [];

    for (const [id, data] of Object.entries(allJourneys)) {
      if (data?.meta && (data.meta.status === 'COMPLETED' || data.meta.status === 'EXPIRED')) {
        const travelersCount = data.history ? Object.keys(data.history).length : (data.members ? Object.keys(data.members).length : 1);
        summaries.push({
          journeyId: id,
          name: data.meta.name || 'Road Trip',
          destinationName: data.meta.destination?.displayName || 'Shared Destination',
          completedAt: data.meta.expiresAt || data.meta.createdAt,
          status: data.meta.status,
          totalTravelers: travelersCount,
        });
      }
    }

    return summaries.sort((a, b) => b.completedAt - a.completedAt);
  } catch (e: any) {
    console.warn('[historyService] listRecentJourneys error:', e.message);
    return [];
  }
}
