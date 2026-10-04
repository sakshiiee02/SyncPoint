import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Alert,
  Linking,
  Clipboard,
  Platform,
  ToastAndroid,
} from 'react-native';
import { useJourneyStore } from '@/store/useJourneyStore';
import { useProfileStore } from '@/store/useProfileStore';
import { endJourneyAction, leaveJourneyAction } from '@/session/journeyActions';
import { StartBlockedError, beginJourney } from '@/tracking/journeyTracking';
import { JourneyError } from '@/data/errors';
import { updateTravelerSetup } from '@/data/journeyRepository';
import { getFirebaseDb } from '@/services/firebase/firebaseApp';
import { usePickedPlace } from '@/store/usePlacePickerStore';
import { PickerTarget, pickedToOrigin } from '@/domain/placeMapping';
import { PlaceField } from '@/components/common/PlaceField';
import { ModeIcon } from '@/components/common/ModeIcon';
import { buildAppLink, buildInviteLink } from '@/domain/inviteLink';
import { travelerStateLabel } from '@/domain/travelerState';
import { ENV } from '@/config/env';
import { CONFIG } from '@/constants/config';
import { JourneyMember, TravelMode, isTravelingState } from '@/types/member';
import { BackIcon, ShareIcon, NavigationArrowIcon, CopyIcon } from '@/components/common/Icons';

interface JourneyLobbyScreenProps {
  /** Called after the user has started their trip (move to the live map). */
  onStarted: () => void;
  /** Called after the user has left / cancelled the journey. */
  onLeft: () => void;
  onBack: () => void;
  onPickPlace: (target: PickerTarget) => void;
}

export const JourneyLobbyScreen: React.FC<JourneyLobbyScreenProps> = ({
  onStarted,
  onLeft,
  onBack,
  onPickPlace,
}) => {
  const currentJourney = useJourneyStore((s) => s.currentJourney);
  const members = useJourneyStore((s) => s.members);
  const profile = useProfileStore((s) => s.profile);
  const [copied, setCopied] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const joinCode = currentJourney?.joinCode ?? '';
  const effectiveJourneyId = currentJourney?.journeyId ?? '';
  const memberList: JourneyMember[] = Object.values(members).sort((a, b) => a.joinedAt - b.joinedAt);
  const isCreator = Boolean(profile?.uid && currentJourney?.creatorUid === profile.uid);
  const myMemberRecord = profile?.uid ? members[profile.uid] : undefined;
  const isStarted = myMemberRecord ? isTravelingState(myMemberRecord.state) : false;

  // Start point and travel mode stay editable until the traveler presses Start.
  const canEditSetup = myMemberRecord?.state === 'WAITING';
  const saveSetup = async (change: Parameters<typeof updateTravelerSetup>[3]) => {
    if (!profile?.uid || !effectiveJourneyId) return;
    try {
      await updateTravelerSetup(getFirebaseDb(), effectiveJourneyId, profile.uid, change);
    } catch (error) {
      const message = error instanceof JourneyError ? error.message : 'Could not save your change.';
      Alert.alert('Not saved', message);
    }
  };
  usePickedPlace('origin', (picked) => {
    if (canEditSetup) saveSetup({ origin: pickedToOrigin(picked) });
  });

  const handleStartJourney = async () => {
    if (isBusy) return;
    if (isStarted) {
      onStarted();
      return;
    }
    try {
      setIsBusy(true);
      await beginJourney();
      onStarted();
    } catch (error) {
      if (error instanceof StartBlockedError) {
        const buttons =
          error.reason === 'PERMISSION' || error.reason === 'LOCATION_OFF'
            ? [
                { text: 'Not now', style: 'cancel' as const },
                { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => undefined) },
              ]
            : [{ text: 'OK' }];
        Alert.alert('Cannot start yet', error.message, buttons);
      } else {
        const message = error instanceof JourneyError ? error.message : 'Could not start the journey.';
        Alert.alert('Cannot start', message);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyCode = () => {
    if (!joinCode) return;
    try {
      Clipboard.setString(joinCode);
      setCopied(true);
      if (Platform.OS === 'android') {
        ToastAndroid.show(`Code ${joinCode} copied to clipboard`, ToastAndroid.SHORT);
      }
      setTimeout(() => setCopied(false), 2500);
    } catch {
      Alert.alert('Copy Error', 'Failed to copy code to clipboard.');
    }
  };

  const handleShareInvite = async () => {
    if (!joinCode) return;
    const link = buildInviteLink(ENV.inviteLinkBaseUrl, joinCode) ?? buildAppLink(joinCode);
    try {
      await Share.share({
        title: `Join ${currentJourney?.name ?? 'my journey'} on SyncPoint`,
        message: `Join our journey "${currentJourney?.name ?? 'Road Trip'}" on SyncPoint!
Invite code: ${joinCode}
${link}`,
      });
    } catch (e: any) {
      Alert.alert('Share Error', e.message);
    }
  };

  const runLeave = async (operation: () => Promise<void>) => {
    try {
      setIsBusy(true);
      await operation();
      onLeft();
    } catch (error) {
      const message = error instanceof JourneyError ? error.message : 'Please try again.';
      Alert.alert('Could not leave', message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleLeave = () => {
    if (isCreator) {
      Alert.alert(
        'Cancel journey?',
        'Cancelling closes this journey for everyone. To hand it over instead, choose "Leave & hand over".',
        [
          { text: 'Stay in lobby', style: 'cancel' },
          {
            text: 'Leave & hand over',
            onPress: () => runLeave(leaveJourneyAction),
          },
          {
            text: 'Cancel journey',
            style: 'destructive',
            onPress: () => runLeave(endJourneyAction),
          },
        ]
      );
    } else {
      Alert.alert('Leave journey?', 'You can rejoin later with the invite code.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => runLeave(leaveJourneyAction) },
      ]);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <BackIcon size={18} color="#0f172a" />
          <Text style={styles.backButtonText}>Home</Text>
        </TouchableOpacity>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>JOURNEY LOBBY</Text>
        </View>
        <Text style={styles.journeyTitle}>{currentJourney?.name || 'Convoy Lobby'}</Text>
        <Text style={styles.destination}>
          Sync Point:{' '}
          <Text style={styles.destinationHighlight}>
            {currentJourney?.destination?.displayName || 'Shared Destination'}
          </Text>
        </Text>
      </View>

      {/* Invite Code & Share Card */}
      <View style={styles.inviteCard}>
        <Text style={styles.inviteLabel}>Invite Friends (Max {CONFIG.MAX_MEMBERS} Travelers)</Text>
        <TouchableOpacity
          style={styles.codeContainer}
          onPress={handleCopyCode}
          activeOpacity={0.7}
        >
          <Text style={styles.codeText}>{joinCode}</Text>
        </TouchableOpacity>

        {/* Link to share commented out as requested */}
        {/* <Text style={styles.inviteUrl}>https://syncpoint.app/join/{joinCode}</Text> */}

        <View style={styles.inviteActionsRow}>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyCode}
            activeOpacity={0.8}
          >
            <CopyIcon size={16} color={copied ? '#16a34a' : '#2563eb'} />
            <Text style={[styles.copyButtonText, copied && styles.copyButtonTextSuccess]}>
              {copied ? 'Copied!' : 'Copy Code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareInvite}
            activeOpacity={0.8}
          >
            <ShareIcon size={16} color="#ffffff" />
            <Text style={styles.shareButtonText}>Share Code</Text>
          </TouchableOpacity>
        </View>
      </View>

      {myMemberRecord && (
        <View style={styles.setupCard}>
          <Text style={styles.sectionTitle}>Your trip</Text>
          <PlaceField
            label="Starting point"
            value={myMemberRecord.origin.displayName}
            detail={
              myMemberRecord.origin.kind === 'GPS'
                ? 'Taken from your GPS when you press Start'
                : undefined
            }
            placeholder="Choose a starting point"
            onPress={() => onPickPlace('origin')}
            disabled={!canEditSetup}
          />
          <View style={styles.modeRow}>
            {(['CAR', 'BIKE', 'WALK'] as TravelMode[]).map((mode) => {
              const selected = myMemberRecord.travelMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modeButton, selected && styles.modeButtonSelected]}
                  disabled={!canEditSetup}
                  onPress={() => saveSetup({ travelMode: mode })}
                  activeOpacity={0.8}
                >
                  <ModeIcon mode={mode} selected={selected} />
                  <Text style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>
                    {mode === 'CAR' ? 'Car' : mode === 'BIKE' ? 'Bike' : 'Walk'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!canEditSetup && <Text style={styles.setupLocked}>Locked once your trip has started.</Text>}
        </View>
      )}

      {/* Members In Convoy */}
      <View style={styles.membersSection}>
        <View style={styles.membersHeader}>
          <Text style={styles.sectionTitle}>Travelers in Convoy</Text>
          <Text style={styles.memberCountBadge}>{memberList.length}/{CONFIG.MAX_MEMBERS}</Text>
        </View>

        {memberList.map((member) => {
          const isMe = member.uid === profile?.uid;
          const isMemberStarted = isTravelingState(member.state);

          return (
            <View key={member.uid} style={[styles.memberCard, isMe && styles.memberCardMe]}>
              <View style={[styles.avatar, isMe && styles.avatarMe]}>
                <Text style={[styles.avatarText, isMe && styles.avatarTextMe]}>
                  {member.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.memberInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName}>
                    {member.name} {isMe ? '(You)' : ''}
                  </Text>
                  {member.uid === currentJourney?.creatorUid && (
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
                  {isMemberStarted ? travelerStateLabel(member.state).toUpperCase() : 'READY'}
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
          onPress={handleStartJourney}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          <NavigationArrowIcon size={18} color="#ffffff" />
          <Text style={styles.startButtonText}>
            {isBusy && !isStarted ? 'Getting your location...' : isStarted ? 'Return to Live Map' : 'Start Journey & Begin Tracking'}
          </Text>
        </TouchableOpacity>

        {isCreator && (
          <Text style={styles.creatorNotice}>
            As creator, you can start tracking now even if other travelers are still in the lobby.
          </Text>
        )}

        <TouchableOpacity style={styles.leaveButton} onPress={handleLeave}>
          <Text style={styles.leaveButtonText}>
            {isCreator ? 'Cancel / Leave Journey' : 'Leave Journey'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8fafc',
    flexGrow: 1,
  },
  setupCard: {
    marginBottom: 24,
    gap: 10,
  },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  modeButtonSelected: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  modeButtonText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  modeButtonTextSelected: { color: '#ffffff' },
  setupLocked: { fontSize: 12, color: '#64748b' },
  header: {
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginBottom: 10,
  },
  backButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  statusPill: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  statusPillText: {
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  journeyTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  destination: {
    fontSize: 14,
    color: '#64748b',
  },
  destinationHighlight: {
    color: '#2563eb',
    fontWeight: '700',
  },
  inviteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 24,
  },
  inviteLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
    fontWeight: '600',
  },
  codeContainer: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    marginBottom: 12,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 6,
  },
  inviteUrl: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16,
  },
  inviteActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  copyButton: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  copyButtonText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  copyButtonTextSuccess: {
    color: '#16a34a',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
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
    fontWeight: '800',
    color: '#0f172a',
  },
  memberCountBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563eb',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  memberCardMe: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarMe: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  avatarText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  avatarTextMe: {
    color: '#ffffff',
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
    fontWeight: '700',
    color: '#0f172a',
  },
  creatorBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#fde68a',
  },
  creatorBadgeText: {
    color: '#b45309',
    fontSize: 9,
    fontWeight: '800',
  },
  memberSub: {
    fontSize: 12,
    color: '#64748b',
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stateBadgeActive: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  stateBadgeLobby: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stateBadgeTextActive: {
    color: '#16a34a',
  },
  stateBadgeTextLobby: {
    color: '#64748b',
  },
  actions: {
    marginTop: 8,
    marginBottom: 30,
    gap: 10,
  },
  startButton: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
    fontWeight: '600',
  },
});
