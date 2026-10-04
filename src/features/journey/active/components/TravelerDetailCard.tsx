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
import { travelerStateLabel } from '@/domain/travelerState';
import {
  CloseIcon,
  PhoneIcon,
  CompassIcon,
  RouteIcon,
  ClockIcon,
  SpeedometerIcon,
  BatteryIcon,
} from '@/components/common/Icons';

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
    charging,
    currentRoad,
    distanceRemainingM,
    etaEpochMs,
    lastUpdatedAt,
    isSharing,
    isLocalUser,
    travelerState,
    originLabel,
  } = participant;

  const speedKmh = Math.round(speedMps * 3.6);
  const isMoving = speedKmh >= 3;
  const hasEta = distanceRemainingM !== null && etaEpochMs !== null;
  const etaSeconds = etaEpochMs !== null ? Math.max(0, Math.floor((etaEpochMs - Date.now()) / 1000)) : 0;
  const onTheRoad = travelerState === 'TRAVELING' || travelerState === 'PAUSED';

  const statusLine = (() => {
    switch (travelerState) {
      case 'WAITING':
        return `Not started • will leave from ${originLabel}`;
      case 'PAUSED':
        return lastUpdatedAt ? `Paused • last seen ${formatRecency(lastUpdatedAt)}` : 'Paused';
      case 'TRAVELING':
        return lastUpdatedAt ? `On the way • updated ${formatRecency(lastUpdatedAt)}` : 'On the way';
      default:
        return travelerStateLabel(travelerState);
    }
  })();

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

        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
          <CloseIcon size={16} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Grid of Telemetry Stats with Vector Icons (Screenshot 2) */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <View style={styles.statHeaderRow}>
            <RouteIcon size={12} color="#64748b" />
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <Text style={styles.statValue}>
            {distanceRemainingM !== null ? formatDistance(distanceRemainingM) : '--'}
          </Text>
        </View>

        <View style={styles.statBox}>
          <View style={styles.statHeaderRow}>
            <ClockIcon size={12} color="#64748b" />
            <Text style={styles.statLabel}>ETA</Text>
          </View>
          <Text style={styles.statValue}>
            {hasEta && onTheRoad ? formatDuration(etaSeconds) : '--'}
          </Text>
          {hasEta && onTheRoad && etaEpochMs !== null && (
            <Text style={styles.statSub}>({formatETA(etaEpochMs)})</Text>
          )}
        </View>

        <View style={styles.statBox}>
          <View style={styles.statHeaderRow}>
            <SpeedometerIcon size={12} color="#64748b" />
            <Text style={styles.statLabel}>Speed</Text>
          </View>
          <Text style={styles.statValue}>
            {!onTheRoad ? '--' : isMoving ? `${speedKmh} km/h` : 'Stopped'}
          </Text>
        </View>

        <View style={styles.statBox}>
          <View style={styles.statHeaderRow}>
            <BatteryIcon size={12} color="#64748b" />
            <Text style={styles.statLabel}>Battery</Text>
          </View>
          <Text style={styles.statValue}>
            {batteryPct !== null ? `${batteryPct}%${charging ? ' +' : ''}` : '--'}
          </Text>
        </View>
      </View>

      {/* Road & Recency Info */}
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Current Road:</Text>
        <Text style={styles.detailText}>{currentRoad || '--'}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Status:</Text>
        <Text style={[styles.detailText, !isSharing && onTheRoad && styles.pausedText]}>
          {statusLine}
        </Text>
      </View>

      {/* Phone Visibility & Call Action */}
      <View style={styles.phoneSection}>
        <View style={styles.phoneInfo}>
          <Text style={styles.phoneLabel}>Phone Number (Convoy Visible)</Text>
          <Text style={styles.phoneNumber}>{phone || 'Not shared'}</Text>
        </View>

        {!isLocalUser && (
          <TouchableOpacity style={styles.callButton} onPress={handleCall} activeOpacity={0.8}>
            <PhoneIcon size={14} color="#ffffff" />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Secondary Route Action */}
      {!isLocalUser && (
        <TouchableOpacity
          style={styles.navigateButton}
          onPress={() => onNavigateToTraveler(participant)}
          activeOpacity={0.8}
        >
          <CompassIcon size={16} color="#ffffff" />
          <Text style={styles.navigateButtonText}>
            Navigate to {name.split(' ')[0]} (Secondary Route)
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
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#0f172a',
    marginBottom: 2,
  },
  destinationSub: {
    fontSize: 12,
    color: '#64748b',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  statSub: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  detailText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  pausedText: {
    color: '#b45309',
  },
  phoneSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  phoneInfo: {
    flex: 1,
  },
  phoneLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  phoneNumber: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  navigateButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navigateButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
