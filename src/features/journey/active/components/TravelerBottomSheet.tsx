import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { ParticipantLiveState } from '@/types/liveLocation';
import { formatDistance, formatDuration } from '@/utils/geoMath';

interface TravelerBottomSheetProps {
  participants: ParticipantLiveState[];
  selectedUid: string | null;
  onSelectParticipant: (uid: string) => void;
  isSharingPaused: boolean;
  onTogglePauseSharing: () => void;
  onOpenChat: () => void;
  onOpenOfflineMap: () => void;
  onFinishJourney: () => void;
}

export const TravelerBottomSheet: React.FC<TravelerBottomSheetProps> = ({
  participants,
  selectedUid,
  onSelectParticipant,
  isSharingPaused,
  onTogglePauseSharing,
  onOpenChat,
  onOpenOfflineMap,
  onFinishJourney,
}) => {
  return (
    <View style={styles.sheetContainer}>
      {/* Handle Bar */}
      <View style={styles.handleBar} />

      {/* Quick Controls Bar */}
      <View style={styles.quickControls}>
        <TouchableOpacity
          style={[styles.pauseButton, isSharingPaused && styles.pauseButtonActive]}
          onPress={onTogglePauseSharing}
          activeOpacity={0.8}
        >
          <Text style={styles.pauseButtonText}>
            {isSharingPaused ? '▶️ Resume' : '⏸️ Pause'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.offlineButton} onPress={onOpenOfflineMap} activeOpacity={0.8}>
          <Text style={styles.offlineButtonText}>🗺️ Offline</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.chatButton} onPress={onOpenChat} activeOpacity={0.8}>
          <Text style={styles.chatButtonText}>💬 Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.finishButton} onPress={onFinishJourney} activeOpacity={0.8}>
          <Text style={styles.finishButtonText}>Finish</Text>
        </TouchableOpacity>
      </View>

      {/* Convoy Travelers List (Section 6.4) */}
      <Text style={styles.listHeader}>Convoy Travelers ({participants.length})</Text>

      <ScrollView style={styles.travelerList} showsVerticalScrollIndicator={false}>
        {participants.map((p) => {
          const isSelected = p.uid === selectedUid;
          const isArrived = p.status === 'BACK_ON_ROUTE' || p.distanceRemainingM < 100;
          const etaSeconds = Math.max(0, Math.floor((p.etaEpochMs - Date.now()) / 1000));

          return (
            <TouchableOpacity
              key={p.uid}
              style={[
                styles.travelerRow,
                p.isLocalUser && styles.localTravelerRow,
                isSelected && styles.selectedRow,
              ]}
              onPress={() => onSelectParticipant(p.uid)}
              activeOpacity={0.7}
            >
              {/* Avatar Initial */}
              <View
                style={[
                  styles.avatar,
                  p.isLocalUser && styles.localAvatar,
                  !p.isSharing && styles.pausedAvatar,
                ]}
              >
                <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
              </View>

              {/* Traveler Info */}
              <View style={styles.travelerInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.travelerName}>
                    {p.name} {p.isLocalUser ? '(You)' : ''}
                  </Text>
                  {!p.isSharing && (
                    <View style={styles.pausedPill}>
                      <Text style={styles.pausedPillText}>PAUSED</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.travelerSub}>
                  {p.currentRoad || 'On route'} • Battery: {p.batteryPct}%
                </Text>
              </View>

              {/* Live Distance & ETA */}
              <View style={styles.statsContainer}>
                {isArrived ? (
                  <View style={styles.arrivedBadge}>
                    <Text style={styles.arrivedText}>ARRIVED</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.etaText}>{formatDuration(etaSeconds)}</Text>
                    <Text style={styles.distanceText}>{formatDistance(p.distanceRemainingM)}</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: 320,
    borderTopWidth: 1.5,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 25,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 12,
  },
  quickControls: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pauseButton: {
    flex: 2,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pauseButtonActive: {
    borderColor: '#eab308',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
  },
  pauseButtonText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  offlineButton: {
    flex: 1.3,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  offlineButtonText: {
    color: '#06b6d4',
    fontSize: 12,
    fontWeight: '700',
  },
  chatButton: {
    flex: 1.2,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chatButtonText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  finishButton: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  finishButtonText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
  listHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  travelerList: {
    maxHeight: 180,
  },
  travelerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  localTravelerRow: {
    borderColor: '#06b6d4',
  },
  selectedRow: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: '#38bdf8',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  localAvatar: {
    borderColor: '#06b6d4',
    borderWidth: 2,
  },
  pausedAvatar: {
    borderColor: '#64748b',
    opacity: 0.5,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  travelerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  travelerName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  pausedPill: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pausedPillText: {
    color: '#eab308',
    fontSize: 9,
    fontWeight: '800',
  },
  travelerSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  etaText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '800',
  },
  distanceText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  arrivedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  arrivedText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },
});
