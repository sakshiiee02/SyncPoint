import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Destination } from '@/types/journey';

interface DestinationMarkerProps {
  destination: Destination;
}

export const DestinationMarker: React.FC<DestinationMarkerProps> = ({ destination }) => {
  return (
    <View style={styles.container}>
      {/* Outer Pulsing Radar Ring */}
      <View style={styles.radarRingDelayed} />
      <View style={styles.radarRing} />

      {/* Center Target Icon */}
      <View style={styles.centerPin}>
        <View style={styles.pinInner} />
      </View>

      {/* Destination Tag */}
      <View style={styles.tagContainer}>
        <Text style={styles.tagLabel}>SYNC POINT</Text>
        <Text style={styles.tagName} numberOfLines={1}>
          {destination.displayName}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
  },
  radarRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.45)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  radarRingDelayed: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    backgroundColor: 'rgba(6, 182, 212, 0.04)',
  },
  centerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#06b6d4',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  pinInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  tagContainer: {
    marginTop: 6,
    backgroundColor: 'rgba(9, 13, 22, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#06b6d4',
    alignItems: 'center',
    maxWidth: 130,
  },
  tagLabel: {
    color: '#06b6d4',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tagName: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
});
