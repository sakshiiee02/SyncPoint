import React from 'react';
import { View, StyleSheet } from 'react-native';

export interface RoutePolylineProps {
  id: string;
  coordinates: Array<[number, number]>; // [lng, lat]
  isLocalUser: boolean;
}

/**
 * Visualizes navigation routes on the map.
 * Enforces Section 6.1: User's own route is visually primary (bold cyan #06b6d4),
 * while fellow traveler routes are subordinate (slate/indigo #6366f1 with lower opacity).
 */
export const RoutePolyline: React.FC<RoutePolylineProps> = ({ isLocalUser }) => {
  // In MapLibre React Native, this translates to MapLibreGL.LineLayer and ShapeSource.
  // This presentation component provides color tokens and styling props.
  const style = isLocalUser ? styles.primaryRoute : styles.subordinateRoute;

  return <View style={style} />;
};

export const ROUTE_STYLES = {
  primary: {
    lineColor: '#06b6d4',
    lineWidth: 5.5,
    lineOpacity: 0.95,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  },
  subordinate: {
    lineColor: '#818cf8',
    lineWidth: 3.0,
    lineOpacity: 0.55,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  },
};

const styles = StyleSheet.create({
  primaryRoute: {
    borderColor: '#06b6d4',
  },
  subordinateRoute: {
    borderColor: '#818cf8',
    opacity: 0.55,
  },
});
