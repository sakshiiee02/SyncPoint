import { LatLng } from '@/utils/geoMath';

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** MapLibre refuses very large offline packs; stay safely below its default 6000-tile cap. */
export const MAX_OFFLINE_TILES = 5500;

/** Rough size of one OpenFreeMap vector tile (plus its share of style, sprites and fonts). */
const APPROX_BYTES_PER_TILE = 30 * 1024;

const MAX_LAT = 85.0511; // Web Mercator limit

export function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

export function latToTileY(lat: number, zoom: number): number {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const rad = (clamped * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

export function tilesAtZoom(bounds: Bounds, zoom: number): number {
  const columns = lngToTileX(bounds.maxLng, zoom) - lngToTileX(bounds.minLng, zoom) + 1;
  const rows = latToTileY(bounds.minLat, zoom) - latToTileY(bounds.maxLat, zoom) + 1;
  return Math.max(1, columns) * Math.max(1, rows);
}

export function totalTiles(bounds: Bounds, minZoom: number, maxZoom: number): number {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) total += tilesAtZoom(bounds, z);
  return total;
}

export function boundsFromPoints(points: LatLng[]): Bounds | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

/** Grows the box by roughly `km` in every direction so the map doesn't end at the road's edge. */
export function padBounds(bounds: Bounds, km: number): Bounds {
  const dLat = km / 111;
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const dLng = km / (111 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));
  return {
    minLat: Math.max(-MAX_LAT, bounds.minLat - dLat),
    maxLat: Math.min(MAX_LAT, bounds.maxLat + dLat),
    minLng: Math.max(-180, bounds.minLng - dLng),
    maxLng: Math.min(180, bounds.maxLng + dLng),
  };
}

export interface ZoomPlan {
  minZoom: number;
  maxZoom: number;
  tiles: number;
  /** True when the region was too big to reach the preferred detail level. */
  reducedDetail: boolean;
}

/**
 * Picks the most detailed zoom range that still fits the tile limit. Long routes get less
 * street-level detail (zoom ~11-12) while short ones get full detail (zoom 14).
 */
export function planZoomRange(
  bounds: Bounds,
  options: { minZoom?: number; preferredMaxZoom?: number; maxTiles?: number } = {}
): ZoomPlan {
  const minZoom = options.minZoom ?? 6;
  const preferred = options.preferredMaxZoom ?? 14;
  const maxTiles = options.maxTiles ?? MAX_OFFLINE_TILES;

  for (let maxZoom = preferred; maxZoom >= minZoom; maxZoom--) {
    const tiles = totalTiles(bounds, minZoom, maxZoom);
    if (tiles <= maxTiles) {
      return { minZoom, maxZoom, tiles, reducedDetail: maxZoom < preferred };
    }
  }
  // Region is enormous: fall back to the coarsest levels only.
  return { minZoom, maxZoom: minZoom, tiles: totalTiles(bounds, minZoom, minZoom), reducedDetail: true };
}

export function estimateBytes(tiles: number): number {
  return tiles * APPROX_BYTES_PER_TILE;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 100 * 1024 * 1024 ? 1 : 0)} MB`;
}
