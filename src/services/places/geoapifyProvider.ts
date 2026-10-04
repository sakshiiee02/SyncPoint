import {
  FetchLike,
  GeocoderProvider,
  GeocodingError,
  PlaceResult,
  SearchOptions,
} from './types';
import { buildQuery } from '@/utils/queryString';

interface GeoapifyItem {
  place_id?: string;
  lat: number;
  lon: number;
  formatted?: string;
  name?: string;
  address_line1?: string;
  address_line2?: string;
}

export function mapGeoapifyItem(item: GeoapifyItem): PlaceResult | null {
  if (typeof item.lat !== 'number' || typeof item.lon !== 'number') return null;
  const name = item.name || item.address_line1 || item.formatted?.split(',')[0] || 'Unnamed place';
  const address = item.address_line2 || item.formatted || '';
  return {
    id: item.place_id ?? `geoapify:${item.lat.toFixed(5)},${item.lon.toFixed(5)}`,
    name,
    address,
    lat: item.lat,
    lng: item.lon,
    provider: 'geoapify',
  };
}

/** Geoapify Geocoding API (free tier, built for type-ahead). */
export class GeoapifyProvider implements GeocoderProvider {
  readonly name = 'geoapify' as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchLike = fetch,
    private readonly baseUrl: string = 'https://api.geoapify.com/v1/geocode'
  ) {}

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async search(query: string, options: SearchOptions = {}): Promise<PlaceResult[]> {
    const params = buildQuery({
      text: query,
      format: 'json',
      limit: options.limit ?? 6,
      lang: 'en',
      bias: options.bias ? `proximity:${options.bias.lng},${options.bias.lat}` : undefined,
      apiKey: this.apiKey,
    });

    const response = await this.fetchFn(`${this.baseUrl}/autocomplete?${params}`, {
      signal: options.signal,
    });
    if (!response.ok) throw new GeocodingError(`Geoapify error ${response.status}`, response.status);

    const json = await response.json();
    return ((json?.results ?? []) as GeoapifyItem[])
      .map(mapGeoapifyItem)
      .filter((p): p is PlaceResult => p !== null);
  }

  async reverse(lat: number, lng: number, signal?: AbortSignal): Promise<PlaceResult | null> {
    const params = buildQuery({ lat, lon: lng, format: 'json', lang: 'en', apiKey: this.apiKey });
    const response = await this.fetchFn(`${this.baseUrl}/reverse?${params}`, { signal });
    if (!response.ok) throw new GeocodingError(`Geoapify error ${response.status}`, response.status);
    const first = (await response.json())?.results?.[0] as GeoapifyItem | undefined;
    return first ? mapGeoapifyItem(first) : null;
  }
}
