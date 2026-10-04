import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '@/constants/config';
import { ENV } from '@/config/env';
import { QuotaGuard } from '@/services/storage/quotaGuard';
import { GeoapifyProvider } from './geoapifyProvider';
import { LocationIqProvider } from './locationIqProvider';
import { PlaceSearchService, RecentPlaces } from './placeSearchService';

export * from './types';
export { MIN_QUERY_LENGTH, SearchUnavailableError } from './placeSearchService';

/** Geoapify first (purpose-built autocomplete), LocationIQ as automatic fallback. */
export const placeSearch = new PlaceSearchService(
  [new GeoapifyProvider(ENV.geoapifyApiKey), new LocationIqProvider(ENV.locationIqApiKey)],
  new QuotaGuard(AsyncStorage, CONFIG.DAILY_QUOTA)
);

export const recentPlaces = new RecentPlaces(AsyncStorage);
