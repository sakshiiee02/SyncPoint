import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  offlineMapService,
  DownloadProgress,
  SavedOfflineMap,
} from '@/services/offlineMaps/offlineMapService';
import { estimateBytes, formatBytes } from '@/domain/tileMath';
import { useNavigationStore } from '@/store/useNavigationStore';
import { useTrackingStore } from '@/store/useTrackingStore';
import { Destination } from '@/types/journey';
import { CloseIcon, RouteIcon } from '@/components/common/Icons';

interface OfflineMapModalProps {
  journeyId: string;
  destination: Destination;
  onClose: () => void;
}

export const OfflineMapModal: React.FC<OfflineMapModalProps> = ({
  journeyId,
  destination,
  onClose,
}) => {
  const [saved, setSaved] = useState<SavedOfflineMap | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const route = useNavigationStore((s) => s.savedCanonicalRoute ?? s.activeRoute);
  const selfFix = useTrackingStore((s) => s.selfFix);

  // The region follows the real route (or, before a route exists, your position and the destination).
  const plan = useMemo(() => {
    const points =
      route && route.source !== 'ESTIMATE'
        ? route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
        : [
            { lat: destination.lat, lng: destination.lng },
            ...(selfFix ? [{ lat: selfFix.lat, lng: selfFix.lng }] : []),
          ];
    return offlineMapService.planRegion(points);
  }, [route, selfFix, destination]);

  const refresh = async () => {
    setSaved(await offlineMapService.getSavedMap(journeyId).catch(() => null));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyId]);

  const handleStartDownload = async () => {
    if (!plan) return;
    setIsDownloading(true);
    setProgress({ percentage: 0, completedTiles: 0, downloadedBytes: 0 });
    try {
      await offlineMapService.download(
        journeyId,
        `${destination.displayName} route`,
        plan,
        setProgress
      );
      await refresh();
      Alert.alert('Download complete', 'The map for this route is saved on your phone and works without signal.');
    } catch (e: any) {
      Alert.alert('Download failed', e?.message ?? 'Check your connection and try again.');
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  };

  const handleDelete = async () => {
    await offlineMapService.deleteSavedMap(journeyId).catch(() => undefined);
    await refresh();
  };

  const estimatedBytes = plan ? estimateBytes(plan.zoom.tiles) : 0;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Offline Map</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <CloseIcon size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        <Text style={styles.description}>
          Save the map along your route so it still shows in areas with no signal. Do this on Wi-Fi
          before you set off.
        </Text>

        <View style={styles.downloadCard}>
          {plan ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Approx. size:</Text>
                <Text style={styles.infoValue}>{formatBytes(estimatedBytes)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Region:</Text>
                <Text style={styles.infoSub} numberOfLines={1}>
                  Route to {destination.displayName}
                </Text>
              </View>
              {plan.zoom.reducedDetail && (
                <Text style={styles.note}>
                  This is a long route, so street-level detail is limited to larger roads and towns.
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.note}>Waiting for your location or route before a region can be chosen.</Text>
          )}

          {isDownloading ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress ? progress.percentage : 0}%` }]} />
              </View>
              <Text style={styles.progressText}>
                Downloading map: {progress ? `${Math.round(progress.percentage)}%` : 'Starting...'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.downloadButton, !plan && styles.downloadDisabled]}
              onPress={handleStartDownload}
              disabled={!plan}
              activeOpacity={0.8}
            >
              <RouteIcon size={16} color="#ffffff" />
              <Text style={styles.downloadButtonText}>
                {saved ? 'Download again' : 'Download route map'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.packsHeader}>On this phone</Text>
        {saved ? (
          <View style={styles.packItem}>
            <View style={styles.packInfo}>
              <Text style={styles.packName}>{saved.label}</Text>
              <Text style={styles.packSize}>
                {saved.isComplete ? 'Saved and ready offline' : `Incomplete (${Math.round(saved.percentage)}%)`}
              </Text>
            </View>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.emptyText}>No offline map saved for this trip yet.</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 50,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 6,
  },
  description: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 16,
  },
  downloadCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
  },
  infoSub: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
    maxWidth: 180,
  },
  downloadButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  downloadDisabled: {
    backgroundColor: '#94a3b8',
  },
  note: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 17,
    marginTop: 2,
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  progressText: {
    fontSize: 11,
    color: '#2563eb',
    textAlign: 'center',
    fontWeight: '600',
  },
  packsHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  packItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  packInfo: {
    flex: 1,
  },
  packName: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  packSize: {
    fontSize: 11,
    color: '#64748b',
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
  },
});
