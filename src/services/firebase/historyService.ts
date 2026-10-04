import AsyncStorage from '@react-native-async-storage/async-storage';
import { JourneyHistorySnapshot, RecentJourneySummary } from '@/types/history';

const RECENT_JOURNEYS_KEY = '@syncpoint_recent_journeys';
const JOURNEY_DETAIL_PREFIX = '@syncpoint_history_';

/**
 * Persists a completed journey locally on the device (AsyncStorage).
 * Trips are stored only on the phone, keeping the shared database lean and private.
 */
export async function saveLocalJourneyHistory(
  snapshot: JourneyHistorySnapshot
): Promise<void> {
  try {
    // 1. Save detailed multi-traveler snapshot locally
    const detailKey = `${JOURNEY_DETAIL_PREFIX}${snapshot.journeyId}`;
    await AsyncStorage.setItem(detailKey, JSON.stringify(snapshot));

    // 2. Update recent journeys summary list
    const summary: RecentJourneySummary = {
      journeyId: snapshot.journeyId,
      name: snapshot.name || 'Road Trip',
      destinationName: snapshot.destination?.displayName || 'Shared Destination',
      completedAt: snapshot.completedAt || Date.now(),
      status: snapshot.status || 'COMPLETED',
      totalTravelers: Object.keys(snapshot.travelers || {}).length || 1,
    };

    const rawList = await AsyncStorage.getItem(RECENT_JOURNEYS_KEY);
    const existingList: RecentJourneySummary[] = rawList ? JSON.parse(rawList) : [];
    const filtered = existingList.filter((item) => item.journeyId !== snapshot.journeyId);
    const updated = [summary, ...filtered].sort((a, b) => b.completedAt - a.completedAt);

    await AsyncStorage.setItem(RECENT_JOURNEYS_KEY, JSON.stringify(updated));
  } catch (e: any) {
    console.warn('[historyService] Failed to save local journey history:', e.message);
  }
}

/**
 * Fetches recent journey history summaries from local device storage.
 */
export async function listRecentJourneys(): Promise<RecentJourneySummary[]> {
  try {
    const rawList = await AsyncStorage.getItem(RECENT_JOURNEYS_KEY);
    if (!rawList) {
      return [];
    }
    const parsed: RecentJourneySummary[] = JSON.parse(rawList);
    return parsed.sort((a, b) => b.completedAt - a.completedAt);
  } catch (e: any) {
    console.warn('[historyService] listRecentJourneys error:', e.message);
    return [];
  }
}

/**
 * Retrieves a saved trip from this phone. History is local-only by design (private, free, works
 * offline), so there is no server fallback.
 */
export async function getJourneyHistory(
  journeyId: string
): Promise<JourneyHistorySnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(`${JOURNEY_DETAIL_PREFIX}${journeyId}`);
    return raw ? (JSON.parse(raw) as JourneyHistorySnapshot) : null;
  } catch (e: any) {
    console.warn('[historyService] Local history read failed:', e.message);
    return null;
  }
}

/**
 * Deletes a local journey history entry.
 */
export async function deleteLocalRecentJourney(journeyId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${JOURNEY_DETAIL_PREFIX}${journeyId}`);
    const rawList = await AsyncStorage.getItem(RECENT_JOURNEYS_KEY);
    if (rawList) {
      const existingList: RecentJourneySummary[] = JSON.parse(rawList);
      const filtered = existingList.filter((item) => item.journeyId !== journeyId);
      await AsyncStorage.setItem(RECENT_JOURNEYS_KEY, JSON.stringify(filtered));
    }
  } catch (e: any) {
    console.warn('[historyService] Failed to delete local journey:', e.message);
  }
}
