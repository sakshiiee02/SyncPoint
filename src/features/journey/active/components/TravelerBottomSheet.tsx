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
import { travelerStateLabel } from '@/domain/travelerState';
import { routeColorFor } from '@/domain/routeSharing';
import { MascotAvatar } from '@/components/common/MascotAvatar';
import { PlayIcon, PauseIcon, RouteIcon, ChatIcon } from '@/components/common/Icons';

interface TravelerBottomSheetProps {
  participants: ParticipantLiveState[];
  selectedUid: string | null;
  onSelectParticipant: (uid: string) => void;
  isSharingPaused: boolean;
  /** Pause/Resume only makes sense while the local traveler is on the road. */
  canTogglePause: boolean;
  onTogglePauseSharing: () => void;
  onOpenChat: () => void;
  onOpenOfflineMap: () => void;
  onFinishJourney: () => void;
  isHost?: boolean;
  nowMs: number;
}

function batteryLabel(p: ParticipantLiveState): string {
  if (p.batteryPct === null) return 'Battery --';
  return `Battery ${p.batteryPct}%${p.charging ? ' (charging)' : ''}`;
}

function subtitle(p: ParticipantLiveState): string {
  switch (p.travelerState) {
    case 'WAITING':
      return `From ${p.originLabel}`;
    case 'FINISHED':
      return 'Trip finished';
    default:
      return `${p.currentRoad || 'On route'} • ${batteryLabel(p)}`;
  }
}

export const TravelerBottomSheet: React.FC<TravelerBottomSheetProps> = ({
  participants,
  selectedUid,
  onSelectParticipant,
  isSharingPaused,
  canTogglePause,
  onTogglePauseSharing,
  onOpenChat,
  onOpenOfflineMap,
  onFinishJourney,
  isHost,
  nowMs,
}) => {
  return (
    <View style={styles.sheetContainer}>
      <View style={styles.handleBar} />

      <View style={styles.quickControls}>
        {canTogglePause && (
          <TouchableOpacity
            style={[styles.controlBtn, isSharingPaused && styles.controlBtnWarning]}
            onPress={onTogglePauseSharing}
            activeOpacity={0.8}
          >
            {isSharingPaused ? (
              <PlayIcon size={14} color="#d97706" />
            ) : (
              <PauseIcon size={14} color="#334155" />
            )}
            <Text style={[styles.controlBtnText, isSharingPaused && styles.controlBtnWarningText]}>
              {isSharingPaused ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.controlBtn} onPress={onOpenOfflineMap} activeOpacity={0.8}>
          <RouteIcon size={14} color="#2563eb" />
          <Text style={styles.controlBtnText}>Offline</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={onOpenChat} activeOpacity={0.8}>
          <ChatIcon size={14} color="#2563eb" />
          <Text style={styles.controlBtnText}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.finishBtn} onPress={onFinishJourney} activeOpacity={0.8}>
          <Text style={styles.finishBtnText}>{isHost ? 'End' : 'Leave'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.listHeader}>Travelers ({participants.length})</Text>

      <ScrollView style={styles.travelerList} showsVerticalScrollIndicator={false}>
        {participants.map((p) => {
          const isSelected = p.uid === selectedUid;
          const state = p.travelerState;
          const onTheRoad = state === 'TRAVELING' || state === 'PAUSED';

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
              <View
                style={[
                  styles.avatar,
                  p.isLocalUser && styles.localAvatar,
                  (state === 'PAUSED' || state === 'WAITING') && styles.pausedAvatar,
                ]}
              >
                <MascotAvatar mascot={p.mascot} size={38} />
              </View>

              <View style={styles.travelerInfo}>
                <View style={styles.nameRow}>
                  {!p.isLocalUser && (
                    <View style={[styles.colorDot, { backgroundColor: routeColorFor(p.seat) }]} />
                  )}
                  <Text style={styles.travelerName}>
                    {p.name} {p.isLocalUser ? '(You)' : ''}
                  </Text>
                  {state === 'PAUSED' && (
                    <View style={styles.pausedPill}>
                      <Text style={styles.pausedPillText}>PAUSED</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.travelerSub} numberOfLines={1}>
                  {subtitle(p)}
                </Text>
              </View>

              <View style={styles.statsContainer}>
                {state === 'ARRIVED' || state === 'FINISHED' ? (
                  <View style={styles.arrivedBadge}>
                    <Text style={styles.arrivedText}>{travelerStateLabel(state).toUpperCase()}</Text>
                  </View>
                ) : state === 'WAITING' ? (
                  <Text style={styles.waitingText}>{travelerStateLabel(state)}</Text>
                ) : onTheRoad && p.distanceRemainingM !== null && p.etaEpochMs !== null ? (
                  <>
                    <Text style={styles.etaText}>
                      {formatDuration(Math.max(0, Math.floor((p.etaEpochMs - nowMs) / 1000)))}
                    </Text>
                    <Text style={styles.distanceText}>{formatDistance(p.distanceRemainingM)}</Text>
                  </>
                ) : (
                  <Text style={styles.waitingText}>Locating...</Text>
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
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: 330,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 25,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  quickControls: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  controlBtn: {
    flex: 1.2,
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  controlBtnWarning: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  controlBtnText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  controlBtnWarningText: {
    color: '#b45309',
  },
  finishBtn: {
    flex: 1,
    backgroundColor: '#fef2f2',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  finishBtnText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  listHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
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
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  localTravelerRow: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  selectedRow: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  localAvatar: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  pausedAvatar: {
    borderColor: '#cbd5e1',
    opacity: 0.5,
  },
  avatarText: {
    color: '#0f172a',
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
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  pausedPill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#fde68a',
  },
  pausedPillText: {
    color: '#b45309',
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
  colorDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  waitingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  etaText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '800',
  },
  distanceText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  arrivedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  arrivedText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '800',
  },
});
