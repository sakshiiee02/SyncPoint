export interface PlaceResult {
  /** Stable id from the provider (or generated for map pins). */
  id: string;
  /** Short, primary label: "Goa International Airport". */
  name: string;
  /** Fuller line to disambiguate: "Dabolim, Goa, India". */
  address: string;
  lat: number;
  lng: number;
  provider: 'geoapify' | 'locationiq' | 'map';
}

export interface SearchOptions {
  /** Where the user is (or the map is centred): results nearer to it are ranked higher. */
  bias?: { lat: number; lng: number };
  limit?: number;
  signal?: AbortSignal;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface GeocoderProvider {
  readonly name: 'geoapify' | 'locationiq';
  /** False when no API key is configured for this provider. */
  readonly isConfigured: boolean;
  /** Autocomplete: places matching a partially typed query. */
  search(query: string, options?: SearchOptions): Promise<PlaceResult[]>;
  /** Address for a coordinate (used when dropping a pin on the map). */
  reverse(lat: number, lng: number, signal?: AbortSignal): Promise<PlaceResult | null>;
}

export class GeocodingError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'GeocodingError';
  }
}
