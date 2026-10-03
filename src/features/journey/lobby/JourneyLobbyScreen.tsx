import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { useJourneyStore } from '@/store/useJourneyStore';
import { useProfileStore } from '@/store/useProfileStore';
import { subscribeToJourney } from '@/services/firebase/rtdbService';
import { JourneyMember } from '@/types/member';

interface JourneyLobbyScreenProps {
  journeyId: string;
  joinCode: string;
  onStartTracking: () => void;
  onLeave: () => void;
}

export const JourneyLobbyScreen: React.FC<JourneyLobbyScreenProps> = ({
  journeyId,
  joinCode,
  onStartTracking,
  onLeave,
}) => {
  const { currentJourney, members, setCurrentJourney, setMembers } = useJourneyStore();
  const { profile } = useProfileStore();

  useEffect(() => {
    const unsubscribe = subscribeToJourney(
      journeyId,
      (meta) => setCurrentJourney(meta),
      (mems) => setMembers(mems)
    );

    return () => unsubscribe();
  }, [journeyId, setCurrentJourney, setMembers]);

  const memberList: JourneyMember[] = Object.values(members);
  const isCreator = currentJourney?.creatorUid === profile?.uid;
  const myMemberRecord = profile?.uid ? members[profile.uid] : undefined;
  const isStarted = myMemberRecord?.sharingState === 'ACTIVE';

  const handleShareInvite = async () => {
    const inviteUrl = `https://syncpoint.app/join/${joinCode}`;
    try {
      await Share.share({
        title: `Join ${currentJourney?.name || 'Road Trip'} on SyncPoint`,
        message: `Join our convoy to ${currentJourney?.destination.displayName}! Open the link: ${inviteUrl} or use code: ${joinCode}`,
      });
    } catch (e: any) {
      Alert.alert('Share Error', e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>JOURNEY LOBBY</Text>
        </View>
        <Text style={styles.journeyTitle}>{currentJourney?.name || 'Loading...'}</Text>
        <Text style={styles.destination}>
          Sync Point: <Text style={styles.destinationHighlight}>{currentJourney?.destination.displayName}</Text>
        </Text>
      </View>

      {/* Invite Code & Share Card */}
      <View style={styles.inviteCard}>
        <Text style={styles.inviteLabel}>Invite Friends (Max 10 Travelers)</Text>
        <View style={styles.codeContainer}>
          <Text style={styles.codeText}>{joinCode}</Text>
        </View>
        <Text style={styles.inviteUrl}>https://syncpoint.app/join/{joinCode}</Text>

        <TouchableOpacity style={styles.shareButton} onPress={handleShareInvite} activeOpacity={0.8}>
          <Text style={styles.shareButtonText}>📤 Share Invite Link & Code</Text>
        </TouchableOpacity>
      </View>

      {/* Members In Convoy */}
      <View style={styles.membersSection}>
        <View style={styles.membersHeader}>
          <Text style={styles.sectionTitle}>Travelers in Convoy</Text>
          <Text style={styles.memberCountBadge}>{memberList.length}/10</Text>
        </View>

        {memberList.map((member) => {
          const isMe = member.uid === profile?.uid;
          const isMemberStarted = member.sharingState === 'ACTIVE';

          return (
            <View key={member.uid} style={[styles.memberCard, isMe && styles.memberCardMe]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{member.name.charAt(0).toUpperCase()}</Text>
              </View>

              <View style={styles.memberInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName}>
                    {member.name} {isMe ? '(You)' : ''}
                  </Text>
                  {member.role === 'CREATOR' && (
                    <View style={styles.creatorBadge}>
                      <Text style={styles.creatorBadgeText}>CREATOR</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.memberSub}>
                  From: {member.origin.displayName} • {member.travelMode}
                </Text>
              </View>

              <View
                style={[
                  styles.stateBadge,
                  isMemberStarted ? styles.stateBadgeActive : styles.stateBadgeLobby,
                ]}
              >
                <Text
                  style={[
                    styles.stateBadgeText,
                    isMemberStarted ? styles.stateBadgeTextActive : styles.stateBadgeTextLobby,
                  ]}
                >
                  {isMemberStarted ? 'TRAVELING' : 'READY'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Start Button / CTA */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={onStartTracking}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>
            {isStarted ? 'Return to Live Map' : 'Start Journey & Begin Tracking 🚀'}
          </Text>
        </TouchableOpacity>

        {isCreator && (
          <Text style={styles.creatorNotice}>
            As creator, you can start tracking now even if other travelers are still in the lobby.
          </Text>
        )}

        <TouchableOpacity style={styles.leaveButton} onPress={onLeave}>
          <Text style={styles.leaveButtonText}>Exit to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#090d16',
    flexGrow: 1,
  },
  header: {
    marginBottom: 20,
  },
  statusPill: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statusPillText: {
    color: '#06b6d4',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  journeyTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 4,
  },
  destination: {
    fontSize: 14,
    color: '#94a3b8',
  },
  destinationHighlight: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  inviteCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#06b6d4',
    alignItems: 'center',
    marginBottom: 24,
  },
  inviteLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 10,
    fontWeight: '500',
  },
  codeContainer: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#06b6d4',
    marginBottom: 8,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 6,
  },
  inviteUrl: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
  },
  shareButton: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#06b6d4',
  },
  shareButtonText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
  membersSection: {
    marginBottom: 24,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  memberCountBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#06b6d4',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  memberCardMe: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.04)',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
  },
  creatorBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#eab308',
  },
  creatorBadgeText: {
    color: '#eab308',
    fontSize: 9,
    fontWeight: '700',
  },
  memberSub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stateBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  stateBadgeLobby: {
    backgroundColor: '#1e293b',
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stateBadgeTextActive: {
    color: '#10b981',
  },
  stateBadgeTextLobby: {
    color: '#94a3b8',
  },
  actions: {
    marginTop: 8,
    marginBottom: 30,
    gap: 10,
  },
  startButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  creatorNotice: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
  leaveButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#64748b',
    fontSize: 14,
  },
});
