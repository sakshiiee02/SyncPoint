import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { ParticipantLiveState } from '@/types/liveLocation';
import { formatDistance, formatDuration } from '@/utils/geoMath';
import { formatRecency, formatETA } from '@/utils/timeFormat';

interface TravelerDetailCardProps {
  participant: ParticipantLiveState;
  destinationName: string;
  onClose: () => void;
  onNavigateToTraveler: (participant: ParticipantLiveState) => void;
}

export const TravelerDetailCard: React.FC<TravelerDetailCardProps> = ({
  participant,
  destinationName,
  onClose,
  onNavigateToTraveler,
}) => {
  const {
    name,
    phone,
    speedMps,
    batteryPct,
    currentRoad,
    distanceRemainingM,
    etaEpochMs,
    lastUpdatedAt,
    isSharing,
    isLocalUser,
  } = participant;

  const speedKmh = Math.round(speedMps * 3.6);
  const isMoving = speedKmh >= 3;
  const etaSeconds = Math.max(0, Math.floor((etaEpochMs - Date.now()) / 1000));

  const handleCall = () => {
    if (!phone) {
      Alert.alert('No Phone', 'This traveler has not provided a contact number.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Call Failed', `Could not dial ${phone}`);
    });
  };

  return (
    <View style={styles.cardContainer}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.travelerName}>
            {name} {isLocalUser ? '(You)' : ''}
          </Text>
          <Text style={styles.destinationSub}>Heading to: {destinationName}</Text>
        </View>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Grid of Telemetry Stats (Section 6.5) */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{formatDistance(distanceRemainingM)}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>ETA</Text>
          <Text style={styles.statValue}>{formatDuration(etaSeconds)}</Text>
          <Text style={styles.statSub}>({formatETA(etaEpochMs)})</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Speed</Text>
          <Text style={styles.statValue}>{isMoving ? `${speedKmh} km/h` : 'Stopped'}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Battery</Text>
          <Text style={styles.statValue}>{batteryPct}%</Text>
        </View>
      </View>

      {/* Road & Recency Info */}
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Current Road:</Text>
        <Text style={styles.detailText}>{currentRoad || 'Corridor'}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Status:</Text>
        <Text style={[styles.detailText, !isSharing && styles.pausedText]}>
          {!isSharing ? `PAUSED • Last seen ${formatRecency(lastUpdatedAt)}` : `Active • updated ${formatRecency(lastUpdatedAt)}`}
        </Text>
      </View>

      {/* Phone Visibility & Call Action (Section 5.3, 6.5, 16.4) */}
      <View style={styles.phoneSection}>
        <View style={styles.phoneInfo}>
          <Text style={styles.phoneLabel}>Phone Number (Convoy Visible)</Text>
          <Text style={styles.phoneNumber}>{phone || 'Not shared'}</Text>
        </View>

        {!isLocalUser && (
          <TouchableOpacity style={styles.callButton} onPress={handleCall} activeOpacity={0.8}>
            <Text style={styles.callButtonText}>📞 Call</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Secondary Route Action (Section 11.3) */}
      {!isLocalUser && (
        <TouchableOpacity
          style={styles.navigateButton}
          onPress={() => onNavigateToTraveler(participant)}
          activeOpacity={0.8}
        >
          <Text style={styles.navigateButtonText}>
            🧭 Navigate to {name.split(' ')[0]} (Secondary Route)
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#06b6d4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 14,
    zIndex: 35,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  titleBlock: {
    flex: 1,
  },
  travelerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 2,
  },
  destinationSub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#334155',
  },
  statLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f8fafc',
  },
  statSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1e293b',
  },
  detailLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  detailText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  pausedText: {
    color: '#eab308',
  },
  phoneSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 10,
  },
  phoneInfo: {
    flex: 1,
  },
  phoneLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  phoneNumber: {
    fontSize: 14,
    color: '#38bdf8',
    fontWeight: '700',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  navigateButton: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: '#06b6d4',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  navigateButtonText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
});
