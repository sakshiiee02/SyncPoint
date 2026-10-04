import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '@/constants/config';
import { ENV } from '@/config/env';
import { QuotaGuard } from '@/services/storage/quotaGuard';
import { LatLng } from '@/utils/geoMath';
import { TravelMode } from '@/types/member';
import { RouteRecord } from '@/types/route';
import { OpenRouteServiceProvider } from './providers/openRouteService';
import { OsrmProvider } from './providers/osrm';
import { GetRouteOptions, RouteService } from './routeService';

/** The app's routing service: OpenRouteService first, public OSRM as fallback, then a labelled estimate. */
export const routeService = new RouteService(
  [
    new OpenRouteServiceProvider(ENV.openRouteServiceApiKey, CONFIG.ROUTING.ORS_BASE_URL),
    new OsrmProvider(CONFIG.ROUTING.OSRM_BASE_URLS),
  ],
  new QuotaGuard(AsyncStorage, CONFIG.DAILY_QUOTA)
);

export function getRoute(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode = 'CAR',
  options?: GetRouteOptions
): Promise<RouteRecord> {
  return routeService.getRoute(origin, destination, mode, options);
}
