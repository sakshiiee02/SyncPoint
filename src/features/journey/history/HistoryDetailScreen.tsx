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
import {
  BackIcon,
  PlayIcon,
  PauseIcon,
  CheckIcon,
  RouteIcon,
  ClockIcon,
  SpeedometerIcon,
} from '@/components/common/Icons';

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
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading Journey Summary...</Text>
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
      isLocalUser: isSelected,
      travelerState: 'ARRIVED',
      travelMode: t.travelMode,
      originLabel: '',
      positionKind: 'LIVE',
      lat: pt.lat,
      lng: pt.lng,
      heading: 0,
      speedMps: isSelected ? activeTraveler.avgSpeedKmh / 3.6 : 0,
      batteryPct: null,
      charging: false,
      status: 'ON_THE_WAY',
      currentRoad: history.destination.displayName,
      distanceRemainingM: 0,
      etaEpochMs: t.finishedAt,
      lastUpdatedAt: t.finishedAt,
      isSharing: true,
      isStale: false,
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
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
            <BackIcon size={18} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>{history.name}</Text>
            <Text style={styles.subtitle}>
              {history.destination.displayName} • Completed
            </Text>
          </View>
        </View>

        {/* Arrival Card Banner (Matching Reference Screenshot 5) */}
        <View style={styles.arrivalHero}>
          <View style={styles.checkCircle}>
            <CheckIcon size={24} color="#ffffff" />
          </View>
          <Text style={styles.arrivalTitle}>You've arrived</Text>
          <Text style={styles.arrivalSub}>at {history.destination.displayName}</Text>
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
              {isPlaying ? (
                <PauseIcon size={14} color="#ffffff" />
              ) : (
                <PlayIcon size={14} color="#ffffff" />
              )}
              <Text style={styles.playButtonText}>{isPlaying ? 'Pause' : 'Replay'}</Text>
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
              <Text style={styles.cardTravelerName}>{activeTraveler.name}'s Summary</Text>

              <View style={styles.statsGrid}>
                <View style={styles.statTile}>
                  <View style={styles.statTileHeader}>
                    <RouteIcon size={14} color="#64748b" />
                    <Text style={styles.statLabel}>Distance</Text>
                  </View>
                  <Text style={styles.statValue}>
                    {formatDistance(activeTraveler.totalDistanceM)}
                  </Text>
                </View>

                <View style={styles.statTile}>
                  <View style={styles.statTileHeader}>
                    <ClockIcon size={14} color="#64748b" />
                    <Text style={styles.statLabel}>Time</Text>
                  </View>
                  <Text style={styles.statValue}>
                    {formatDuration(activeTraveler.durationS)}
                  </Text>
                </View>

                <View style={styles.statTile}>
                  <View style={styles.statTileHeader}>
                    <SpeedometerIcon size={14} color="#64748b" />
                    <Text style={styles.statLabel}>Avg Speed</Text>
                  </View>
                  <Text style={styles.statValue}>{activeTraveler.avgSpeedKmh} km/h</Text>
                </View>

                <View style={styles.statTile}>
                  <View style={styles.statTileHeader}>
                    <SpeedometerIcon size={14} color="#64748b" />
                    <Text style={styles.statLabel}>Peak Speed</Text>
                  </View>
                  <Text style={styles.statValue}>{activeTraveler.maxSpeedKmh} km/h</Text>
                </View>
              </View>

              {/* Compression Metadata */}
              <View style={styles.compressionBanner}>
                <Text style={styles.compressionTitle}>Polyline Optimization</Text>
                <Text style={styles.compressionSub}>
                  {activeTraveler.pointsSampleCount} raw GPS fixes compressed to{' '}
                  {activeTraveler.compressedPolyline.length} key vertices ({compressionRatio}% reduction)
                  for indefinite retention.
                </Text>
              </View>

              {/* Done Action Button (Matching Reference Screenshot 5) */}
              <TouchableOpacity style={styles.doneButton} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
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
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    marginBottom: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
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
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  arrivalHero: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  checkCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  arrivalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  arrivalSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  mapBox: {
    height: 220,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  scrubberBox: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
  },
  chipsSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#ffffff',
  },
  sectionHeader: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipsRow: {
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedChip: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  chipText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  selectedChipText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  statsScroll: {
    flex: 1,
  },
  statsContainer: {
    padding: 16,
  },
  statsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTravelerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
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
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  compressionBanner: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
  },
  compressionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
    marginBottom: 2,
  },
  compressionSub: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
  doneButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
