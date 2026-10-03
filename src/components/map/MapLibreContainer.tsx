import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Destination } from '@/types/journey';
import { ParticipantLiveState } from '@/types/liveLocation';
import { DestinationMarker } from './DestinationMarker';
import { TravelerMarker } from './TravelerMarker';

interface MapLibreContainerProps {
  destination: Destination;
  participants: ParticipantLiveState[];
  selectedParticipantUid: string | null;
  onSelectParticipant: (uid: string) => void;
  children?: React.ReactNode;
}

/**
 * Core Map presentation container.
 * In React Native environment, wraps MapLibreGL.MapView with Dark Matter raster/vector styling.
 */
export const MapLibreContainer: React.FC<MapLibreContainerProps> = ({
  destination,
  participants,
  onSelectParticipant,
  children,
}) => {
  return (
    <View style={styles.mapViewport}>
      {/* Background Carto Dark Map Placeholder */}
      <View style={styles.gridCanvas}>
        {/* Render Destination Marker */}
        <View style={styles.destinationWrapper}>
          <DestinationMarker destination={destination} />
        </View>

        {/* Render Live Participant Markers */}
        {participants.map((p) => (
          <View key={p.uid} style={styles.participantWrapper}>
            <TravelerMarker
              participant={p}
              onPress={() => onSelectParticipant(p.uid)}
            />
          </View>
        ))}
      </View>

      {/* Floating Children (Recenter button, Next maneuver banner, etc.) */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  mapViewport: {
    flex: 1,
    backgroundColor: '#070b12',
    overflow: 'hidden',
    position: 'relative',
  },
  gridCanvas: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationWrapper: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
  },
  participantWrapper: {
    position: 'absolute',
    top: '55%',
    alignSelf: 'center',
  },
});
