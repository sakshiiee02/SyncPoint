import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { JourneyHistorySnapshot, TravelerHistoryRecord } from '@/types/history';
import { getJourneyHistory } from '@/services/firebase/historyService';
import { MapLibreContainer } from '@/components/map/MapLibreContainer';
import { ParticipantLiveState } from '@/types/liveLocation';
import { formatDistance, formatDuration } from '@/utils/geoMath';

interface HistoryDetailScreenProps {
  journeyId: string;
  onClose: () => void;
}

export const HistoryDetailScreen: React.FC<HistoryDetailScreenProps> = ({
  journeyId,
  onClose,
}) => {
  const [history, setHistory] = useState<JourneyHistorySnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTravelerUid, setSelectedTravelerUid] = useState<string | null>(null);
  const [replayProgress, setReplayProgress] = useState(1.0); // 0.0 to 1.0
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await getJourneyHistory(journeyId);
        if (data && Object.keys(data.travelers).length > 0) {
          setHistory(data);
          const firstUid = Object.keys(data.travelers)[0];
          setSelectedTravelerUid(firstUid);
        } else {
          setHistory(null);
        }
      } catch (e) {
        setHistory(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, [journeyId]);

  // Replay playback loop
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setReplayProgress((prev) => {
          if (prev >= 1.0) {
            setIsPlaying(false);
            return 1.0;
          }
          return Math.min(1.0, prev + 0.05);
        });
      }, 350);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
    }

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#06b6d4" />
        <Text style={styles.loadingText}>Loading Journey History...</Text>
      </View>
    );
  }

  if (!history) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No history record found for this trip.</Text>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const travelersList = Object.values(history.travelers);
  const activeTraveler: TravelerHistoryRecord | undefined =
    travelersList.find((t) => t.uid === selectedTravelerUid) || travelersList[0];

  // Derive replay position along polyline
  let replayPoint = { lat: history.destination.lat, lng: history.destination.lng };
  if (activeTraveler && activeTraveler.compressedPolyline.length > 0) {
    const coords = activeTraveler.compressedPolyline;
    const index = Math.min(
      coords.length - 1,
      Math.floor(replayProgress * (coords.length - 1))
    );
    replayPoint = { lat: coords[index][1], lng: coords[index][0] };
  }

  // Convert travelers to ParticipantLiveState for MapLibreContainer display
  const mapParticipants: ParticipantLiveState[] = travelersList.map((t) => {
    const isSelected = t.uid === activeTraveler?.uid;
    const coords = t.compressedPolyline;
    const pt = isSelected && coords.length > 0
      ? replayPoint
      : coords.length > 0
      ? { lat: coords[coords.length - 1][1], lng: coords[coords.length - 1][0] }
      : { lat: history.destination.lat, lng: history.destination.lng };

    return {
      uid: t.uid,
      name: t.name,
      phone: '',
      travelMode: t.travelMode,
      role: 'MEMBER',
      lat: pt.lat,
      lng: pt.lng,
      heading: 0,
      speedMps: isSelected ? (activeTraveler.avgSpeedKmh / 3.6) : 0,
      batteryPct: 100,
      status: 'ON_THE_WAY',
      lastUpdatedAt: t.finishedAt,
      currentRoad: history.destination.displayName,
      distanceRemainingM: 0,
      etaEpochMs: t.finishedAt,
      routeVersion: 1,
      isSharing: true,
      sharingState: 'FINISHED',
      isStale: false,
      isLocalUser: isSelected,
    };
  });

  const compressionRatio = activeTraveler?.pointsSampleCount
    ? Math.round(
        (1 - activeTraveler.compressedPolyline.length / activeTraveler.pointsSampleCount) * 100
      )
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>{history.name}</Text>
            <Text style={styles.subtitle}>
              🏁 {history.destination.displayName} • {history.status}
            </Text>
          </View>
        </View>

        {/* Map Preview of Route History */}
        <View style={styles.mapBox}>
          <MapLibreContainer
            destination={history.destination}
            participants={mapParticipants}
            selectedParticipantUid={selectedTravelerUid}
            onSelectParticipant={(uid) => setSelectedTravelerUid(uid)}
          />
        </View>

        {/* Scrubber / Replay Controls */}
        <View style={styles.scrubberBox}>
          <View style={styles.scrubberRow}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => {
                if (replayProgress >= 1.0) setReplayProgress(0.0);
                setIsPlaying(!isPlaying);
              }}
            >
              <Text style={styles.playButtonText}>{isPlaying ? '⏸ Pause' : '▶ Replay'}</Text>
            </TouchableOpacity>

            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${replayProgress * 100}%` }]} />
            </View>

            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setIsPlaying(false);
                setReplayProgress(1.0);
              }}
            >
              <Text style={styles.resetText}>End</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.progressLabel}>
            Replay Progress: {Math.round(replayProgress * 100)}% • Reconstructed GPS Path
          </Text>
        </View>

        {/* Traveler Selector Chips */}
        <View style={styles.chipsSection}>
          <Text style={styles.sectionHeader}>Convoy Travelers ({travelersList.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {travelersList.map((t) => {
              const isSelected = t.uid === activeTraveler?.uid;
              return (
                <TouchableOpacity
                  key={t.uid}
                  style={[styles.chip, isSelected && styles.selectedChip]}
                  onPress={() => {
                    setSelectedTravelerUid(t.uid);
                    setReplayProgress(1.0);
                    setIsPlaying(false);
                  }}
                >
                  <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>
                    {t.name} ({t.travelMode})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Selected Traveler Statistics Summary Card */}
        {activeTraveler && (
          <ScrollView style={styles.statsScroll} contentContainerStyle={styles.statsContainer}>
            <View style={styles.statsCard}>
              <Text style={styles.cardTravelerName}>{activeTraveler.name}'s Journey Summary</Text>

              <View style={styles.statsGrid}>
                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>Total Distance</Text>
                  <Text style={styles.statValue}>
                    {formatDistance(activeTraveler.totalDistanceM)}
                  </Text>
                </View>

                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>Total Time</Text>
                  <Text style={styles.statValue}>
                    {formatDuration(activeTraveler.durationS)}
                  </Text>
                </View>

                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>Average Speed</Text>
                  <Text style={styles.statValue}>{activeTraveler.avgSpeedKmh} km/h</Text>
                </View>

                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>Peak Speed</Text>
                  <Text style={styles.statValue}>{activeTraveler.maxSpeedKmh} km/h</Text>
                </View>
              </View>

              {/* Compression Metadata */}
              <View style={styles.compressionBanner}>
                <Text style={styles.compressionTitle}>⚡ Polyline Compression</Text>
                <Text style={styles.compressionSub}>
                  {activeTraveler.pointsSampleCount} raw GPS fixes compressed to{' '}
                  {activeTraveler.compressedPolyline.length} key vertices ({compressionRatio}% reduction)
                  for indefinite retention.
                </Text>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#f87171',
    fontSize: 16,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
    gap: 12,
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  closeText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  mapBox: {
    height: 260,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  scrubberBox: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  playButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sliderTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#06b6d4',
  },
  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
  },
  chipsSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionHeader: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipsRow: {
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectedChip: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  selectedChipText: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  statsScroll: {
    flex: 1,
  },
  statsContainer: {
    padding: 16,
  },
  statsCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardTravelerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 4,
  },
  compressionBanner: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
  },
  compressionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 2,
  },
  compressionSub: {
    fontSize: 11,
    color: '#cbd5e1',
    lineHeight: 16,
  },
});
