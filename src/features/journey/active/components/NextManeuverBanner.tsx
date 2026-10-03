import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface NextManeuverBannerProps {
  instruction: string;
  distanceToManeuver: string;
  currentRoad?: string;
}

/**
 * Top floating navigation banner displaying next turn maneuver.
 * Matches Section 6.4 & Section 11.2 of Developer Handoff.
 */
export const NextManeuverBanner: React.FC<NextManeuverBannerProps> = ({
  instruction,
  distanceToManeuver,
  currentRoad = 'NH 44',
}) => {
  return (
    <View style={styles.bannerContainer}>
      <View style={styles.maneuverRow}>
        <View style={styles.iconCircle}>
          <Text style={styles.turnIcon}>↰</Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.distanceText}>{distanceToManeuver}</Text>
          <Text style={styles.instructionText} numberOfLines={1}>
            {instruction}
          </Text>
        </View>
      </View>

      {currentRoad ? (
        <View style={styles.roadPill}>
          <Text style={styles.roadText}>On: {currentRoad}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#06b6d4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 30,
  },
  maneuverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnIcon: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  textContainer: {
    flex: 1,
  },
  distanceText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  instructionText: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 2,
  },
  roadPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#334155',
  },
  roadText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '600',
  },
});
