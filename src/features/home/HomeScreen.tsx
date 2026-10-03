import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useJourneyStore } from '@/store/useJourneyStore';
import { useProfileStore } from '@/store/useProfileStore';

interface HomeScreenProps {
  onCreateJourney: () => void;
  onJoinJourney: () => void;
  onOpenJourney: (journeyId: string) => void;
  onOpenProfile: () => void;
  onOpenHistory?: (journeyId: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onCreateJourney,
  onJoinJourney,
  onOpenJourney,
  onOpenProfile,
  onOpenHistory,
}) => {
  const { currentJourney, members } = useJourneyStore();
  const { profile } = useProfileStore();

  const activeMembersCount = Object.values(members).filter(
    (m) => m.sharingState === 'ACTIVE'
  ).length;
  const totalMembersCount = Object.keys(members).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top App Header */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandTitle}>SyncPoint</Text>
            <Text style={styles.brandTagline}>Group Journey & Road Trip Sync</Text>
          </View>
          <TouchableOpacity style={styles.profileBadge} onPress={onOpenProfile}>
            <Text style={styles.profileInitial}>
              {profile?.name ? profile.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Journey Card (Section 6.3) */}
        {currentJourney && currentJourney.status !== 'COMPLETED' && currentJourney.status !== 'EXPIRED' ? (
          <View style={styles.activeCard}>
            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activePillText}>ACTIVE JOURNEY</Text>
            </View>
            <Text style={styles.journeyName}>{currentJourney.name}</Text>
            <Text style={styles.destinationName}>
              Destination: {currentJourney.destination.displayName}
            </Text>
            <Text style={styles.travelerStats}>
              {activeMembersCount}/{totalMembersCount} travelers active
            </Text>

            <TouchableOpacity
              style={styles.openButton}
              onPress={() => onOpenJourney(currentJourney.journeyId)}
              activeOpacity={0.8}
            >
              <Text style={styles.openButtonText}>Open Live Journey</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active trip</Text>
            <Text style={styles.emptySubtitle}>
              Ready for a road trip? Create a journey with your friends or join an existing convoy.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={onCreateJourney}
            activeOpacity={0.8}
          >
            <Text style={styles.createButtonText}>+ Create New Journey</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.joinButton}
            onPress={onJoinJourney}
            activeOpacity={0.8}
          >
            <Text style={styles.joinButtonText}>Join with Code or Link</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Journeys History (Section 6.3) */}
        <View style={styles.recentSection}>
          <Text style={styles.recentHeader}>Recent Trips (Indefinite History)</Text>
          <TouchableOpacity
            style={styles.recentItem}
            activeOpacity={0.7}
            onPress={() => onOpenHistory && onOpenHistory('journey_demo_goa')}
          >
            <View>
              <Text style={styles.recentTitle}>Goa Coastal Road Trip</Text>
              <Text style={styles.recentSubtitle}>Dabolim Airport • Completed • 3 Travelers</Text>
            </View>
            <Text style={styles.recentDate}>Replay ➔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.recentItem}
            activeOpacity={0.7}
            onPress={() => onOpenHistory && onOpenHistory('journey_demo_jaipur')}
          >
            <View>
              <Text style={styles.recentTitle}>Jaipur Highway Convoy</Text>
              <Text style={styles.recentSubtitle}>Amber Fort • Completed • 2 Travelers</Text>
            </View>
            <Text style={styles.recentDate}>Replay ➔</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  container: {
    padding: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#06b6d4',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  profileBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#06b6d4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '700',
  },
  activeCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#06b6d4',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 24,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  activePillText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  journeyName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  destinationName: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 6,
  },
  travelerStats: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
  },
  openButton: {
    backgroundColor: '#06b6d4',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  openButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  createButton: {
    backgroundColor: '#06b6d4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  joinButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  joinButtonText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '600',
  },
  recentSection: {
    marginTop: 8,
  },
  recentHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 2,
  },
  recentSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  recentDate: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
