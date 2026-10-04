import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ParticipantLiveState } from '@/types/liveLocation';
import { formatDistance } from '@/utils/geoMath';
import { formatRecency } from '@/utils/timeFormat';
import { AlertTriangleIcon } from '@/components/common/Icons';
import { MascotAvatar } from '@/components/common/MascotAvatar';

interface TravelerMarkerProps {
  participant: ParticipantLiveState;
  onPress?: () => void;
}

export const TravelerMarker: React.FC<TravelerMarkerProps> = ({ participant, onPress }) => {
  const {
    name,
    speedMps,
    distanceRemainingM,
    isLocalUser,
    isSharing,
    isStale,
    lastUpdatedAt,
    heading,
    travelerState,
    positionKind,
  } = participant;

  const speedKmh = Math.round(speedMps * 3.6);
  const isMoving = speedKmh >= 3 && travelerState === 'TRAVELING';
  const notOnRoad = travelerState === 'WAITING' || positionKind === 'ORIGIN';
  const dimmed = notOnRoad || travelerState === 'PAUSED';
  const caption = (() => {
    if (travelerState === 'WAITING') return 'Not started';
    if (travelerState === 'PAUSED') return lastUpdatedAt ? `Last seen ${formatRecency(lastUpdatedAt)}` : 'Paused';
    if (travelerState === 'ARRIVED') return 'Arrived';
    if (distanceRemainingM === null) return 'Locating...';
    return `${formatDistance(distanceRemainingM)} • ${isMoving ? `${speedKmh} km/h` : 'Stopped'}`;
  })();

  return (
    <View
      style={[
        styles.container,
        dimmed && styles.pausedContainer,
      ]}
      onTouchEnd={onPress}
    >
      {/* Callsign Badge */}
      <View
        style={[
          styles.callsignBox,
          isLocalUser && styles.localCallsignBox,
          dimmed && styles.pausedCallsignBox,
        ]}
      >
        <Text style={[styles.callsignName, isLocalUser && styles.localCallsignText]} numberOfLines={1}>
          {name} {isLocalUser ? '(You)' : ''}
        </Text>
        <Text style={styles.callsignSub}>{caption}</Text>
      </View>

      {/* Pin / Circle Marker */}
      <View
        style={[
          styles.markerCircle,
          isLocalUser && styles.localMarkerCircle,
          dimmed && styles.pausedMarkerCircle,
        ]}
      >
        {/* Heading Indicator pointer if moving */}
        {isMoving && (
          <View
            style={[
              styles.headingPointer,
              { transform: [{ rotate: `${heading}deg` }] },
            ]}
          />
        )}
        <MascotAvatar mascot={participant.mascot} size={isLocalUser ? 40 : 36} />
      </View>

      {/* Stale Warning Badge (Vector Icon, Zero Emojis) */}
      {isStale && isSharing && travelerState === 'TRAVELING' && (
        <View style={styles.staleBadge}>
          <AlertTriangleIcon size={14} color="#dc2626" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
  },
  pausedContainer: {
    opacity: 0.5,
  },
  callsignBox: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 4,
    minWidth: 90,
    maxWidth: 135,
  },
  localCallsignBox: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  pausedCallsignBox: {
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  callsignName: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '700',
  },
  localCallsignText: {
    color: '#2563eb',
  },
  callsignSub: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '500',
  },
  markerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  localMarkerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  pausedMarkerCircle: {
    backgroundColor: '#94a3b8',
    borderColor: '#e2e8f0',
  },
  headingPointer: {
    position: 'absolute',
    top: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#2563eb',
  },
  initialText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  staleBadge: {
    position: 'absolute',
    top: 24,
    right: 36,
    backgroundColor: '#fee2e2',
    padding: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
});
