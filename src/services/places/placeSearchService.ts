import { QuotaGuard } from '@/services/storage/quotaGuard';
import { KeyValueStore } from '@/services/storage/keyValueStore';
import { GeocoderProvider, GeocodingError, PlaceResult, SearchOptions } from './types';

/** Thrown when no provider could answer (no keys, quota used up, or all failing). */
export class SearchUnavailableError extends GeocodingError {
  constructor() {
    super('Place search is unavailable right now.');
    this.name = 'SearchUnavailableError';
  }
}

export const MIN_QUERY_LENGTH = 3;

const normalise = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ');
const biasBucket = (bias?: { lat: number; lng: number }) =>
  bias ? `${bias.lat.toFixed(1)},${bias.lng.toFixed(1)}` : 'none';

/**
 * Place search across providers with automatic fallback:
 * cache → provider 1 (within its daily share) → provider 2 → SearchUnavailableError.
 * Results are cached per query so typing, deleting and retyping costs one request, not many.
 */
export class PlaceSearchService {
  private cache = new Map<string, PlaceResult[]>();

  constructor(
    private readonly providers: GeocoderProvider[],
    private readonly quota: QuotaGuard,
    private readonly maxCacheEntries: number = 100
  ) {}

  get isAvailable(): boolean {
    return this.providers.some((p) => p.isConfigured);
  }

  async search(query: string, options: SearchOptions = {}): Promise<PlaceResult[]> {
    const text = normalise(query);
    if (text.length < MIN_QUERY_LENGTH) return [];

    const key = `${text}|${biasBucket(options.bias)}`;
    const cached = this.cache.get(key);
    if (cached) {
      // Refresh recency for LRU eviction.
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    const results = await this.firstAnswer((p) => p.search(text, options), options.signal);
    this.remember(key, results);
    return results;
  }

  async reverse(lat: number, lng: number, signal?: AbortSignal): Promise<PlaceResult | null> {
    return this.firstAnswer((p) => p.reverse(lat, lng, signal), signal);
  }

  private async firstAnswer<T>(call: (p: GeocoderProvider) => Promise<T>, signal?: AbortSignal): Promise<T> {
    for (const provider of this.providers) {
      if (!provider.isConfigured) continue;
      if (!(await this.quota.tryConsume(provider.name))) continue;
      try {
        return await call(provider);
      } catch (error) {
        // A cancelled request (user kept typing) is not a provider failure: stop quietly.
        if (signal?.aborted || (error as Error)?.name === 'AbortError') throw error;
        console.warn(`[Places] ${provider.name} failed:`, (error as Error)?.message);
      }
    }
    throw new SearchUnavailableError();
  }

  private remember(key: string, results: PlaceResult[]): void {
    this.cache.set(key, results);
    if (this.cache.size > this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
  }
}

/** Last few places the user picked, shown before they type anything. */
export class RecentPlaces {
  constructor(
    private readonly store: KeyValueStore,
    private readonly storageKey: string = '@syncpoint_recent_places',
    private readonly max: number = 8
  ) {}

  async list(): Promise<PlaceResult[]> {
    try {
      const raw = await this.store.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as PlaceResult[]) : [];
    } catch {
      return [];
    }
  }

  async add(place: PlaceResult): Promise<void> {
    if (place.provider === 'map') return; // dropped pins aren't "places" worth recalling
    const existing = await this.list();
    const next = [place, ...existing.filter((p) => p.id !== place.id)].slice(0, this.max);
    await this.store.setItem(this.storageKey, JSON.stringify(next));
  }
}
