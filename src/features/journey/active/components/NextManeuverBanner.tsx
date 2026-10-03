import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface NextManeuverBannerProps {
  instruction: string;
  distanceToManeuver: string;
  maneuverIcon?: string;
  currentRoad?: string;
  isOffRoute?: boolean;
  isSecondaryRoute?: boolean;
  secondaryTravelerName?: string | null;
  onExitSecondaryRoute?: () => void;
}

/**
 * Top floating navigation banner displaying next turn maneuver, road name,
 * off-route warnings, and temporary secondary traveler route badges.
 * Matches Section 6.4, 11.2, and 11.3 of Developer Handoff.
 */
export const NextManeuverBanner: React.FC<NextManeuverBannerProps> = ({
  instruction,
  distanceToManeuver,
  maneuverIcon = '⬆️',
  currentRoad = 'NH 48',
  isOffRoute = false,
  isSecondaryRoute = false,
  secondaryTravelerName,
  onExitSecondaryRoute,
}) => {
  return (
    <View style={[styles.bannerContainer, isOffRoute && styles.offRouteBanner, isSecondaryRoute && styles.secondaryBanner]}>
      {/* Secondary Route Notification (Section 11.3) */}
      {isSecondaryRoute && (
        <View style={styles.secondaryHeader}>
          <Text style={styles.secondaryHeaderText}>
            🧭 Navigating to {secondaryTravelerName || 'Traveler'} (Temporary Route)
          </Text>
          <TouchableOpacity onPress={onExitSecondaryRoute} style={styles.exitSecondaryButton}>
            <Text style={styles.exitSecondaryText}>Return to Journey</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Off-Route Alert */}
      {isOffRoute && (
        <View style={styles.offRouteBadge}>
          <Text style={styles.offRouteText}>⚠️ Off Route • Recalculating route...</Text>
        </View>
      )}

      <View style={styles.maneuverRow}>
        <View style={[styles.iconCircle, isOffRoute && styles.offRouteIconCircle]}>
          <Text style={styles.turnIcon}>{maneuverIcon}</Text>
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
  offRouteBanner: {
    borderColor: '#eab308',
    backgroundColor: 'rgba(26, 20, 10, 0.96)',
  },
  secondaryBanner: {
    borderColor: '#818cf8',
  },
  secondaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#818cf8',
  },
  secondaryHeaderText: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '700',
  },
  exitSecondaryButton: {
    backgroundColor: '#818cf8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  exitSecondaryText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  offRouteBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  offRouteText: {
    color: '#eab308',
    fontSize: 11,
    fontWeight: '700',
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
  offRouteIconCircle: {
    backgroundColor: '#eab308',
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
