import {
  FetchLike,
  GeocoderProvider,
  GeocodingError,
  PlaceResult,
  SearchOptions,
} from './types';
import { buildQuery } from '@/utils/queryString';

interface LocationIqItem {
  place_id?: string;
  lat: string;
  lon: string;
  display_name?: string;
  display_place?: string;
  display_address?: string;
}

export function mapLocationIqItem(item: LocationIqItem): PlaceResult | null {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: item.place_id ? `liq:${item.place_id}` : `liq:${lat.toFixed(5)},${lng.toFixed(5)}`,
    name: item.display_place || item.display_name?.split(',')[0] || 'Unnamed place',
    address: item.display_address || item.display_name || '',
    lat,
    lng,
    provider: 'locationiq',
  };
}

/** LocationIQ autocomplete / reverse geocoding (free tier), used as the fallback provider. */
export class LocationIqProvider implements GeocoderProvider {
  readonly name = 'locationiq' as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchLike = fetch,
    private readonly autocompleteUrl: string = 'https://api.locationiq.com/v1/autocomplete',
    private readonly reverseUrl: string = 'https://us1.locationiq.com/v1/reverse'
  ) {}

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async search(query: string, options: SearchOptions = {}): Promise<PlaceResult[]> {
    const params = buildQuery({
      key: this.apiKey,
      q: query,
      limit: options.limit ?? 6,
      dedupe: 1,
      format: 'json',
      normalizecity: 1,
    });
    const response = await this.fetchFn(`${this.autocompleteUrl}?${params}`, { signal: options.signal });
    // LocationIQ answers 404 "Unable to geocode" when nothing matches: that is an empty result.
    if (response.status === 404) return [];
    if (!response.ok) throw new GeocodingError(`LocationIQ error ${response.status}`, response.status);

    const json = await response.json();
    return (Array.isArray(json) ? (json as LocationIqItem[]) : [])
      .map(mapLocationIqItem)
      .filter((p): p is PlaceResult => p !== null);
  }

  async reverse(lat: number, lng: number, signal?: AbortSignal): Promise<PlaceResult | null> {
    const params = buildQuery({ key: this.apiKey, lat, lon: lng, format: 'json' });
    const response = await this.fetchFn(`${this.reverseUrl}?${params}`, { signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new GeocodingError(`LocationIQ error ${response.status}`, response.status);
    const json = await response.json();
    return json && json.lat ? mapLocationIqItem(json as LocationIqItem) : null;
  }
}
