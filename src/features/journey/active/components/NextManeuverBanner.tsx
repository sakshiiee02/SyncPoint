import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  TurnRightIcon,
  TurnLeftIcon,
  StraightIcon,
  NavigationArrowIcon,
  AlertTriangleIcon,
  CompassIcon,
} from '@/components/common/Icons';

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
 * MNC Light Mode design extracted from Reference Screenshots. Zero gradients, zero emojis.
 */
export const NextManeuverBanner: React.FC<NextManeuverBannerProps> = ({
  instruction,
  distanceToManeuver,
  maneuverIcon,
  currentRoad = 'NH 48',
  isOffRoute = false,
  isSecondaryRoute = false,
  secondaryTravelerName,
  onExitSecondaryRoute,
}) => {
  // Render appropriate vector icon based on instruction / icon cue
  const renderManeuverIcon = () => {
    const textLower = (instruction + (maneuverIcon || '')).toLowerCase();
    if (textLower.includes('right')) {
      return <TurnRightIcon size={24} color="#ffffff" />;
    }
    if (textLower.includes('left')) {
      return <TurnLeftIcon size={24} color="#ffffff" />;
    }
    if (textLower.includes('continue') || textLower.includes('straight')) {
      return <StraightIcon size={24} color="#ffffff" />;
    }
    return <NavigationArrowIcon size={22} color="#ffffff" />;
  };

  return (
    <View
      style={[
        styles.bannerContainer,
        isOffRoute && styles.offRouteBanner,
        isSecondaryRoute && styles.secondaryBanner,
      ]}
    >
      {/* Secondary Route Notification (Section 11.3) */}
      {isSecondaryRoute && (
        <View style={styles.secondaryHeader}>
          <View style={styles.secondaryHeaderTitleRow}>
            <CompassIcon size={14} color="#2563eb" />
            <Text style={styles.secondaryHeaderText}>
              Navigating to {secondaryTravelerName || 'Traveler'}
            </Text>
          </View>
          <TouchableOpacity onPress={onExitSecondaryRoute} style={styles.exitSecondaryButton}>
            <Text style={styles.exitSecondaryText}>Return to Main</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Off-Route Alert */}
      {isOffRoute && (
        <View style={styles.offRouteBadge}>
          <AlertTriangleIcon size={14} color="#b45309" />
          <Text style={styles.offRouteText}>Off Route • Recalculating path...</Text>
        </View>
      )}

      <View style={styles.maneuverRow}>
        <View style={[styles.iconCircle, isOffRoute && styles.offRouteIconCircle]}>
          {renderManeuverIcon()}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.distanceText}>{distanceToManeuver}</Text>
          <Text style={styles.instructionText} numberOfLines={2}>
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
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  offRouteBanner: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  secondaryBanner: {
    borderColor: '#2563eb',
  },
  secondaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  secondaryHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryHeaderText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  exitSecondaryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  exitSecondaryText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  offRouteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  offRouteText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '700',
  },
  maneuverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offRouteIconCircle: {
    backgroundColor: '#d97706',
  },
  textContainer: {
    flex: 1,
  },
  distanceText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  instructionText: {
    fontSize: 14,
    color: '#334155',
    marginTop: 2,
    fontWeight: '600',
  },
  roadPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roadText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
});
