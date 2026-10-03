import React, { useState, useEffect } from 'react';
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
  BoundingBox,
} from '@/services/offlineMaps/offlineMapService';
import { OfflineMapPackRecord } from '@/db/sqliteClient';
import { Destination } from '@/types/journey';

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
  const [downloadPacks, setDownloadPacks] = useState<OfflineMapPackRecord[]>([]);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const routeBounds: BoundingBox = {
    minLat: Math.min(28.6139, destination.lat) - 0.2,
    maxLat: Math.max(28.6139, destination.lat) + 0.2,
    minLng: Math.min(77.209, destination.lng) - 0.2,
    maxLng: Math.max(77.209, destination.lng) + 0.2,
  };

  const estimatedBytes = offlineMapService.estimatePackSize(routeBounds);

  useEffect(() => {
    loadPacks();
  }, [journeyId]);

  const loadPacks = async () => {
    const packs = await offlineMapService.getDownloadedPacks(journeyId);
    setDownloadPacks(packs);
  };

  const handleStartDownload = async () => {
    setIsDownloading(true);
    try {
      await offlineMapService.downloadRegion(
        journeyId,
        `${destination.displayName} Route Corridor`,
        routeBounds,
        (prog) => setProgress(prog)
      );
      setIsDownloading(false);
      setProgress(null);
      await loadPacks();
      Alert.alert('Download Complete', 'Offline map pack is saved and ready for no-signal areas.');
    } catch (e: any) {
      setIsDownloading(false);
      Alert.alert('Download Failed', e.message);
    }
  };

  const handleDeletePack = async (packId: string) => {
    await offlineMapService.deletePack(packId);
    await loadPacks();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Offline Map Downloads</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.description}>
          Download the road corridor so you can view map tiles and continue your route even when network coverage is lost in rural stretches.
        </Text>

        {/* Estimated Size & Download Card */}
        <View style={styles.downloadCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estimated Pack Size:</Text>
            <Text style={styles.infoValue}>{offlineMapService.formatBytes(estimatedBytes)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Corridor Region:</Text>
            <Text style={styles.infoSub} numberOfLines={1}>{destination.displayName}</Text>
          </View>

          {isDownloading ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress ? progress.percentage : 0}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                Downloading tiles: {progress ? `${progress.percentage}%` : 'Starting...'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={handleStartDownload}
              activeOpacity={0.8}
            >
              <Text style={styles.downloadButtonText}>⬇️ Download Corridor Pack</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Saved Packs List */}
        <Text style={styles.packsHeader}>Downloaded Packs ({downloadPacks.length})</Text>
        {downloadPacks.length === 0 ? (
          <Text style={styles.emptyText}>No offline map downloaded for this trip yet.</Text>
        ) : (
          downloadPacks.map((pack) => (
            <View key={pack.packId} style={styles.packItem}>
              <View style={styles.packInfo}>
                <Text style={styles.packName}>{pack.name}</Text>
                <Text style={styles.packSize}>
                  {offlineMapService.formatBytes(pack.sizeBytes)} • Saved
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDeletePack(pack.packId)}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 50,
  },
  container: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1.5,
    borderColor: '#06b6d4',
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
    color: '#f8fafc',
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 16,
  },
  downloadCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  infoSub: {
    fontSize: 12,
    color: '#cbd5e1',
    maxWidth: 180,
  },
  downloadButton: {
    backgroundColor: '#06b6d4',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
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
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#06b6d4',
  },
  progressText: {
    fontSize: 11,
    color: '#38bdf8',
    textAlign: 'center',
    fontWeight: '600',
  },
  packsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  packItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  packInfo: {
    flex: 1,
  },
  packName: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '600',
  },
  packSize: {
    fontSize: 11,
    color: '#94a3b8',
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#ef4444',
  },
  deleteText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
});
