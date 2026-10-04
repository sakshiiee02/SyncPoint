import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Destination } from '@/types/journey';

interface DestinationMarkerProps {
  destination: Destination;
}

export const DestinationMarker: React.FC<DestinationMarkerProps> = ({ destination }) => {
  return (
    <View style={styles.container}>
      {/* Outer Soft Halo */}
      <View style={styles.haloRing} />

      {/* Red Map Pin with White Center Dot (Matching Reference Screenshot 4) */}
      <View style={styles.pinBody}>
        <View style={styles.pinDot} />
      </View>

      {/* Destination Tag Pill */}
      <View style={styles.tagContainer}>
        <Text style={styles.tagLabel}>DESTINATION</Text>
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
  haloRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  pinBody: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  tagContainer: {
    marginTop: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    maxWidth: 130,
  },
  tagLabel: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  tagName: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '700',
  },
});
