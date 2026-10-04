import React from 'react';
import { View, StyleSheet } from 'react-native';

export interface RoutePolylineProps {
  id: string;
  coordinates: Array<[number, number]>; // [lng, lat]
  isLocalUser: boolean;
}

/**
  * Visualizes navigation routes on the map.
  * Section 6.1: User's own route is visually primary (solid Google/Apple blue #2563eb),
  * while fellow traveler routes are subordinate (clean slate #94a3b8 with lower opacity).
  */
export const RoutePolyline: React.FC<RoutePolylineProps> = ({ isLocalUser }) => {
  const style = isLocalUser ? styles.primaryRoute : styles.subordinateRoute;
  return <View style={style} />;
};

export const ROUTE_STYLES = {
  primary: {
    lineColor: '#2563eb',
    lineWidth: 6.0,
    lineOpacity: 1.0,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  },
  subordinate: {
    lineColor: '#94a3b8',
    lineWidth: 3.5,
    lineOpacity: 0.6,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  },
};

const styles = StyleSheet.create({
  primaryRoute: {
    borderColor: '#2563eb',
  },
  subordinateRoute: {
    borderColor: '#94a3b8',
    opacity: 0.6,
  },
});
