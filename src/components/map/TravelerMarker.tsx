import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ParticipantLiveState } from '@/types/liveLocation';
import { formatDistance } from '@/utils/geoMath';
import { formatRecency } from '@/utils/timeFormat';

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
  } = participant;

  const speedKmh = Math.round(speedMps * 3.6);
  const isMoving = speedKmh >= 3;
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <View
      style={[
        styles.container,
        !isSharing && styles.pausedContainer,
      ]}
      onTouchEnd={onPress}
    >
      {/* Callsign Badge */}
      <View
        style={[
          styles.callsignBox,
          isLocalUser && styles.localCallsignBox,
          !isSharing && styles.pausedCallsignBox,
        ]}
      >
        <Text style={[styles.callsignName, isLocalUser && styles.localCallsignText]} numberOfLines={1}>
          {name} {isLocalUser ? '(You)' : ''} {!isSharing ? '• PAUSED' : ''}
        </Text>
        <Text style={styles.callsignSub}>
          {!isSharing
            ? `Last seen ${formatRecency(lastUpdatedAt)}`
            : `${formatDistance(distanceRemainingM)} • ${isMoving ? `${speedKmh} km/h` : 'Stopped'}`}
        </Text>
      </View>

      {/* Pin / Circle Marker */}
      <View
        style={[
          styles.markerCircle,
          isLocalUser && styles.localMarkerCircle,
          !isSharing && styles.pausedMarkerCircle,
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
        <Text style={styles.initialText}>{initial}</Text>
      </View>

      {/* Stale Warning Badge */}
      {isStale && isSharing && (
        <View style={styles.staleBadge}>
          <Text style={styles.staleText}>⚠️</Text>
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
    opacity: 0.45,
  },
  callsignBox: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    marginBottom: 4,
    minWidth: 90,
    maxWidth: 135,
  },
  localCallsignBox: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
  },
  pausedCallsignBox: {
    borderColor: '#64748b',
  },
  callsignName: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  localCallsignText: {
    color: '#38bdf8',
  },
  callsignSub: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
  },
  markerCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#3b82f6',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  localMarkerCircle: {
    backgroundColor: '#06b6d4',
    borderColor: '#ffffff',
    borderWidth: 3,
    shadowColor: '#06b6d4',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  pausedMarkerCircle: {
    backgroundColor: '#64748b',
    borderColor: '#94a3b8',
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
    borderBottomColor: '#06b6d4',
  },
  initialText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  staleBadge: {
    position: 'absolute',
    top: 24,
    right: 36,
  },
  staleText: {
    fontSize: 12,
  },
});
