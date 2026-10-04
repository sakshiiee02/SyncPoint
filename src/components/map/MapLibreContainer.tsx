import React, { useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { Destination } from '@/types/journey';
import { ParticipantLiveState } from '@/types/liveLocation';
import { DestinationMarker } from './DestinationMarker';
import { TravelerMarker } from './TravelerMarker';

// Inform MapLibre that no proprietary token is required
MapLibreGL.setAccessToken(null);

export interface SharedRouteLine {
  uid: string;
  color: string;
  coordinates: Array<[number, number]>;
  /** Selected traveler (or overview mode): drawn bolder than the rest. */
  emphasized: boolean;
}

interface MapLibreContainerProps {
  destination: Destination;
  participants: ParticipantLiveState[];
  selectedParticipantUid: string | null;
  onSelectParticipant: (uid: string) => void;
  routeCoordinates?: Array<[number, number]>;
  /** Other travelers' routes, drawn beneath the local route. */
  sharedRoutes?: SharedRouteLine[];
  isOverviewMode?: boolean;
  children?: React.ReactNode;
}

import { CONFIG } from '@/constants/config';

// OpenFreeMap: 100% Free & Open-Source Vector Map Style (Zero API Keys, Zero Watermarks, No Sign-up)
// Built specifically for MapLibre Native applications
const OPEN_FREE_MAP_STYLE = CONFIG.MAP.TILE_URL || 'https://tiles.openfreemap.org/styles/bright';

/**
 * Core Map presentation container backed by MapLibre Native.
 * Features Carto Voyager light MNC tiles, real-time camera tracking,
 * route polyline overlays, and interactive convoy participant markers.
 */
export const MapLibreContainer: React.FC<MapLibreContainerProps> = ({
  destination,
  participants,
  selectedParticipantUid,
  onSelectParticipant,
  routeCoordinates,
  sharedRoutes = [],
  isOverviewMode = false,
  children,
}) => {
  const cameraRef = useRef<MapLibreGL.CameraRef>(null);

  const localUser = participants.find((p) => p.isLocalUser);
  const selectedUser = participants.find((p) => p.uid === selectedParticipantUid);

  const centerCoord = useMemo<[number, number]>(() => {
    if (selectedUser && selectedUser.positionKind !== 'NONE') {
      return [selectedUser.lng, selectedUser.lat];
    }
    if (localUser && localUser.positionKind !== 'NONE') {
      return [localUser.lng, localUser.lat];
    }
    return [destination.lng, destination.lat];
  }, [selectedUser, localUser, destination]);

  const routeGeoJson = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return null;
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: routeCoordinates,
      },
      properties: {},
    };
  }, [routeCoordinates]);

  return (
    <View style={styles.mapViewport}>
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={OPEN_FREE_MAP_STYLE}
        logoEnabled={false}
        attributionEnabled
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          zoomLevel={isOverviewMode ? 10 : 14}
          centerCoordinate={centerCoord}
          animationMode="easeTo"
          animationDuration={800}
        />

        {/* Friends' routes: subordinate to yours, bolder when selected or in overview */}
        {sharedRoutes.map((line) =>
          line.coordinates.length >= 2 ? (
            <MapLibreGL.ShapeSource
              key={`shared-${line.uid}`}
              id={`sharedRouteSource-${line.uid}`}
              shape={{
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: line.coordinates },
                properties: {},
              }}
            >
              <MapLibreGL.LineLayer
                id={`sharedRouteLine-${line.uid}`}
                style={{
                  lineColor: line.color,
                  lineWidth: line.emphasized ? 5 : 3,
                  lineOpacity: line.emphasized || isOverviewMode ? 0.85 : 0.5,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </MapLibreGL.ShapeSource>
          ) : null
        )}

        {/* Route Polyline */}
        {routeGeoJson && (
          <MapLibreGL.ShapeSource id="convoyRouteSource" shape={routeGeoJson}>
            <MapLibreGL.LineLayer
              id="convoyRouteLine"
              style={{
                lineColor: '#2563eb',
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Destination Marker */}
        {destination.lat && destination.lng ? (
          <MapLibreGL.PointAnnotation
            id="destination-marker"
            coordinate={[destination.lng, destination.lat]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <DestinationMarker destination={destination} />
          </MapLibreGL.PointAnnotation>
        ) : null}

        {/* Live Participants */}
        {participants.map((p) => {
          if (p.positionKind === 'NONE') return null;
          return (
            <MapLibreGL.PointAnnotation
              key={p.uid}
              id={`participant-${p.uid}`}
              coordinate={[p.lng, p.lat]}
              anchor={{ x: 0.5, y: 0.5 }}
              onSelected={() => onSelectParticipant(p.uid)}
            >
              <TravelerMarker
                participant={p}
                onPress={() => onSelectParticipant(p.uid)}
              />
            </MapLibreGL.PointAnnotation>
          );
        })}
      </MapLibreGL.MapView>

      {/* Floating Children (Top Overlay, Camera Recenter, etc.) */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  mapViewport: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
