import MapLibreGL from '@maplibre/maplibre-react-native';
import { CONFIG } from '@/constants/config';
import { Bounds, ZoomPlan, boundsFromPoints, padBounds, planZoomRange } from '@/domain/tileMath';
import { LatLng } from '@/utils/geoMath';

export interface DownloadProgress {
  percentage: number;
  completedTiles: number;
  downloadedBytes: number;
}

export interface OfflineRegionPlan {
  bounds: Bounds;
  zoom: ZoomPlan;
}

export interface SavedOfflineMap {
  journeyId: string;
  label: string;
  percentage: number;
  isComplete: boolean;
}

const packName = (journeyId: string) => `syncpoint_${journeyId}`;
const PADDING_KM = 8;

/**
 * Real offline maps through MapLibre's OfflineManager (tiles are downloaded to the device and
 * used automatically when there is no signal). MapLibre owns the pack list, so there is no
 * separate record that could drift from what's actually on disk.
 */
class OfflineMapService {
  /** Region = the route (or the straight span between the points we have) plus a margin. */
  planRegion(points: LatLng[]): OfflineRegionPlan | null {
    const raw = boundsFromPoints(points);
    if (!raw) return null;
    const bounds = padBounds(raw, PADDING_KM);
    return { bounds, zoom: planZoomRange(bounds) };
  }

  async getSavedMap(journeyId: string): Promise<SavedOfflineMap | null> {
    const pack = await MapLibreGL.offlineManager.getPack(packName(journeyId));
    if (!pack) return null;
    const status = await pack.status();
    return {
      journeyId,
      label: (pack.metadata?.label as string | undefined) ?? 'Offline map',
      percentage: status.percentage,
      isComplete: status.percentage >= 100,
    };
  }

  /** Downloads the region; resolves when every tile is stored, rejects on failure. */
  async download(
    journeyId: string,
    label: string,
    plan: OfflineRegionPlan,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<void> {
    const name = packName(journeyId);
    // Replace any previous download for this journey.
    await MapLibreGL.offlineManager.deletePack(name).catch(() => undefined);
    MapLibreGL.offlineManager.setTileCountLimit(6000);

    const { bounds, zoom } = plan;
    await new Promise<void>((resolve, reject) => {
      MapLibreGL.offlineManager
        .createPack(
          {
            name,
            styleURL: CONFIG.MAP.TILE_URL,
            bounds: [
              [bounds.maxLng, bounds.maxLat],
              [bounds.minLng, bounds.minLat],
            ],
            minZoom: zoom.minZoom,
            maxZoom: zoom.maxZoom,
            metadata: { journeyId, label },
          },
          (_pack, status) => {
            onProgress({
              percentage: status.percentage,
              completedTiles: status.completedTileCount,
              downloadedBytes: status.completedTileSize,
            });
            if (status.percentage >= 100) resolve();
          },
          (_pack, error) => reject(new Error(error.message))
        )
        .catch(reject);
    });
  }

  async deleteSavedMap(journeyId: string): Promise<void> {
    await MapLibreGL.offlineManager.deletePack(packName(journeyId));
  }
}

export const offlineMapService = new OfflineMapService();
