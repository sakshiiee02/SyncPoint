import React, { useEffect, useState } from 'react';
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
import { listRecentJourneys } from '@/services/firebase/historyService';
import { RecentJourneySummary } from '@/types/history';
import { isTravelingState } from '@/types/member';
import { MascotAvatar } from '@/components/common/MascotAvatar';
import {
  SearchIcon,
  MicIcon,
  RestaurantIcon,
  GasPumpIcon,
  CoffeeIcon,
  ChevronRightIcon,
  PinIcon,
  UserIcon,
} from '@/components/common/Icons';

interface HomeScreenProps {
  onCreateJourney: () => void;
  onJoinJourney: () => void;
  onResumeJourney: () => void;
  onOpenProfile: () => void;
  onOpenHistory?: (journeyId: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onCreateJourney,
  onJoinJourney,
  onResumeJourney,
  onOpenProfile,
  onOpenHistory,
}) => {
  const currentJourney = useJourneyStore((s) => s.currentJourney);
  const members = useJourneyStore((s) => s.members);
  const { profile } = useProfileStore();
  const [recentTrips, setRecentTrips] = useState<RecentJourneySummary[]>([]);

  // Load local recent journeys (managed locally, offline-first)
  useEffect(() => {
    async function loadRecent() {
      try {
        const trips = await listRecentJourneys();
        setRecentTrips(trips);
      } catch (e) {
        setRecentTrips([]);
      }
    }
    loadRecent();
  }, [currentJourney]);

  const activeMembersCount = Object.values(members).filter((m) =>
    isTravelingState(m.state)
  ).length;
  const totalMembersCount = Object.keys(members).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top App Bar & Profile Avatar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandTitle}>SyncPoint</Text>
            <Text style={styles.brandTagline}>Group Journey & Convoy Sync</Text>
          </View>
          <TouchableOpacity style={styles.profileBadge} onPress={onOpenProfile} activeOpacity={0.8}>
            {profile?.mascot ? (
              <MascotAvatar mascot={profile.mascot} size={40} />
            ) : (
              <Text style={styles.profileInitial}>?</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* MNC Search Bar Pill (Matching Reference Screenshot 1) */}
        <TouchableOpacity style={styles.searchBarPill} onPress={onCreateJourney} activeOpacity={0.8}>
          <SearchIcon size={20} color="#64748b" />
          <Text style={styles.searchPlaceholder}>Search destination or plan route...</Text>
          <MicIcon size={20} color="#64748b" />
        </TouchableOpacity>

        {/* MNC Category Quick Chips (Matching Reference Screenshot 1) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          <TouchableOpacity style={styles.categoryChip} onPress={onCreateJourney} activeOpacity={0.7}>
            <View style={[styles.categoryIconWrap, { backgroundColor: '#eff6ff' }]}>
              <RestaurantIcon size={16} color="#2563eb" />
            </View>
            <Text style={styles.categoryLabel}>Restaurants</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryChip} onPress={onCreateJourney} activeOpacity={0.7}>
            <View style={[styles.categoryIconWrap, { backgroundColor: '#fef3c7' }]}>
              <GasPumpIcon size={16} color="#d97706" />
            </View>
            <Text style={styles.categoryLabel}>Gas</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.categoryChip} onPress={onCreateJourney} activeOpacity={0.7}>
            <View style={[styles.categoryIconWrap, { backgroundColor: '#ecfdf5' }]}>
              <CoffeeIcon size={16} color="#16a34a" />
            </View>
            <Text style={styles.categoryLabel}>Coffee</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Active Journey Card */}
        {currentJourney ? (
          <View style={styles.activeCard}>
            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activePillText}>LIVE CONVOY ACTIVE</Text>
            </View>
            <Text style={styles.journeyName}>{currentJourney.name}</Text>
            <View style={styles.destinationRow}>
              <PinIcon size={14} color="#64748b" />
              <Text style={styles.destinationName}>
                {currentJourney.destination.displayName}
              </Text>
            </View>
            <View style={styles.statsRow}>
              <UserIcon size={14} color="#64748b" />
              <Text style={styles.travelerStats}>
                {activeMembersCount}/{totalMembersCount} travelers actively sharing
              </Text>
            </View>

            <TouchableOpacity
              style={styles.openButton}
              onPress={onResumeJourney}
              activeOpacity={0.8}
            >
              <Text style={styles.openButtonText}>Resume Journey</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Ready for a road trip?</Text>
            <Text style={styles.emptySubtitle}>
              Create a journey toward a common destination, or join a friend's convoy with their invite code.
            </Text>
          </View>
        )}

        {/* Primary Action Buttons */}
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
            <Text style={styles.joinButtonText}>Join with Invite Code</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Journeys History */}
        <View style={styles.recentSection}>
          <Text style={styles.recentHeader}>Recent Trips (Route History)</Text>
          {recentTrips.length === 0 ? (
            <View style={styles.emptyRecentBox}>
              <Text style={styles.emptyRecentText}>
                No completed road trips yet. Completed journeys are stored here indefinitely for route replay.
              </Text>
            </View>
          ) : (
            recentTrips.map((trip) => (
              <TouchableOpacity
                key={trip.journeyId}
                style={styles.recentItem}
                activeOpacity={0.7}
                onPress={() => onOpenHistory && onOpenHistory(trip.journeyId)}
              >
                <View style={styles.recentContent}>
                  <Text style={styles.recentTitle}>{trip.name}</Text>
                  <Text style={styles.recentSubtitle}>
                    {trip.destinationName} • {trip.totalTravelers} Travelers
                  </Text>
                </View>
                <ChevronRightIcon size={18} color="#94a3b8" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  searchBarPill: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  searchPlaceholder: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    paddingHorizontal: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  categoryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  activeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
    marginRight: 6,
  },
  activePillText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  journeyName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  destinationName: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  travelerStats: {
    fontSize: 13,
    color: '#64748b',
  },
  openButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  openButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  createButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  joinButton: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  joinButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  recentSection: {
    marginTop: 8,
  },
  recentHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recentContent: {
    flex: 1,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 3,
  },
  recentSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyRecentBox: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyRecentText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
  },
});

