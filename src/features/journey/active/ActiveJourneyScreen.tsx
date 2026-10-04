import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { useJourneyStore } from '@/store/useJourneyStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useLiveLocationStore } from '@/store/useLiveLocationStore';
import { useNavigationStore } from '@/store/useNavigationStore';
import { useTrackingStore } from '@/store/useTrackingStore';
import { buildParticipantViews } from '@/domain/participantView';
import { isTerminalTravelerState, isTravelingState } from '@/types/member';
import { ParticipantLiveState } from '@/types/liveLocation';
import { QuickStatusType } from '@/types/status';
import { JourneyError } from '@/data/errors';
import { useNow } from '@/hooks/useNow';
import { useConnectivityStore } from '@/services/connectivity';
import {
  endJourneyAction,
  finishJourneyAction,
  leaveJourneyAction,
} from '@/session/journeyActions';
import { resumeTrackingIfNeeded, stopTracking } from '@/tracking/journeyTracking';
import { trackingController } from '@/tracking/trackingController';
import { getRoute } from '@/services/routing';
import { broadcastQuickStatus } from '@/services/firebase/statusService';
import { MapLibreContainer } from '@/components/map/MapLibreContainer';
import { RecenterButton } from '@/components/map/RecenterButton';
import { BackIcon } from '@/components/common/Icons';
import { formatDistance } from '@/utils/geoMath';
import { CONFIG } from '@/constants/config';
import { NextManeuverBanner } from './components/NextManeuverBanner';
import { TravelerBottomSheet } from './components/TravelerBottomSheet';
import { TravelerDetailCard } from './components/TravelerDetailCard';
import { OfflineMapModal } from './components/OfflineMapModal';
import { QuickStatusPicker } from './components/QuickStatusPicker';
import { EmergencyActionSheet } from './components/EmergencyActionSheet';

interface ActiveJourneyScreenProps {
  /** Return to Home after the user has finished / left / ended the journey. */
  onExit: () => void;
  /** Go back to Home while the journey (and sharing) keeps running. */
  onBack: () => void;
  onOpenChat: () => void;
}

/**
 * The live map. This screen only *displays* state: GPS, routing, voice, arrival detection and
 * publishing are done by the TrackingController, so they keep working when this screen is closed.
 */
export const ActiveJourneyScreen: React.FC<ActiveJourneyScreenProps> = ({
  onExit,
  onBack,
  onOpenChat,
}) => {
  const currentJourney = useJourneyStore((s) => s.currentJourney);
  const members = useJourneyStore((s) => s.members);
  const uid = useProfileStore((s) => s.uid);
  const locations = useLiveLocationStore((s) => s.locations);
  const selectedTravelerUid = useLiveLocationStore((s) => s.selectedTravelerUid);
  const setSelectedTravelerUid = useLiveLocationStore((s) => s.setSelectedTravelerUid);
  const tracking = useTrackingStore();
  const nav = useNavigationStore();
  const nowMs = useNow(5000);
  const isOnline = useConnectivityStore((s) => s.isOnline);

  const [isOverviewMode, setIsOverviewMode] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  const me = uid ? members[uid] : undefined;
  const onTheRoad = me ? isTravelingState(me.state) : false;
  const isHost = Boolean(uid && currentJourney?.creatorUid === uid);

  const participants = useMemo(
    () =>
      buildParticipantViews({
        members,
        locations,
        selfUid: uid,
        self: {
          fix: tracking.selfFix,
          batteryPct: tracking.batteryPct,
          charging: tracking.charging,
          distanceRemainingM: tracking.distanceRemainingM,
          etaEpochMs: tracking.etaEpochMs,
          currentRoad: tracking.currentRoad,
          status: tracking.status,
        },
        nowMs,
        staleMs: CONFIG.STALE_WARNING_MS,
      }),
    [
      members,
      locations,
      uid,
      tracking.selfFix,
      tracking.batteryPct,
      tracking.charging,
      tracking.distanceRemainingM,
      tracking.etaEpochMs,
      tracking.currentRoad,
      tracking.status,
      nowMs,
    ]
  );
  const localParticipant = participants.find((p) => p.isLocalUser);
  const selectedParticipant = participants.find((p) => p.uid === selectedTravelerUid);

  // Back on the road after an app restart / a previously denied permission.
  useEffect(() => {
    if (onTheRoad && !tracking.isTracking) resumeTrackingIfNeeded().catch(() => undefined);
  }, [onTheRoad, tracking.isTracking]);

  // ── exits: finish my trip / leave / end for everyone ──────────────────────────────────
  const runExit = async (
    operation: () => Promise<unknown>,
    doneTitle: string,
    doneMessage: string
  ) => {
    try {
      await stopTracking();
      await operation();
      Alert.alert(doneTitle, doneMessage, [{ text: 'OK', onPress: () => exitRef.current() }]);
    } catch (error) {
      const message = error instanceof JourneyError ? error.message : 'Please try again.';
      Alert.alert('Something went wrong', message);
    }
  };

  const handleFinishTrip = () =>
    runExit(finishJourneyAction, 'Trip finished', 'Your trip was saved to your history.');

  const handleLeaveOrEnd = () => {
    const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
      { text: 'Cancel', style: 'cancel' },
    ];
    if (me && !isTerminalTravelerState(me.state)) {
      buttons.push({ text: 'Finish my trip', onPress: handleFinishTrip });
    }
    buttons.push({
      text: isHost ? 'Hand over & leave' : 'Leave journey',
      style: 'destructive',
      onPress: () =>
        runExit(leaveJourneyAction, 'Left journey', 'You left the journey. Your trip was saved.'),
    });
    if (isHost) {
      buttons.push({
        text: 'End for everyone',
        style: 'destructive',
        onPress: () => runExit(endJourneyAction, 'Journey ended', 'The journey ended for everyone.'),
      });
    }
    Alert.alert(
      isHost ? 'Finish, leave or end?' : 'Finish or leave?',
      'Finishing keeps the journey going for your friends. Leaving removes you from it.',
      buttons
    );
  };

  // ── arrival prompt (raised once by the controller) ────────────────────────────────────
  useEffect(() => {
    if (!tracking.arrivalPromptPending) return;
    trackingController.clearArrivalPrompt();
    Alert.alert(
      "You've arrived!",
      `You have reached ${currentJourney?.destination.displayName ?? 'the destination'}. Finish when you're done; until then your friends can still see you.`,
      [
        { text: 'Keep sharing', style: 'cancel' },
        { text: 'Finish my trip', onPress: handleFinishTrip },
      ]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking.arrivalPromptPending]);

  // ── actions ───────────────────────────────────────────────────────────────────────────
  const handleSelectStatus = async (status: QuickStatusType) => {
    if (!uid || !me || !currentJourney) return;
    try {
      await trackingController.setStatus(status);
      await broadcastQuickStatus(currentJourney.journeyId, { uid, name: me.name }, status);
    } catch (e: any) {
      console.warn('Failed to update status:', e.message);
    }
  };

  const handleTogglePause = async () => {
    try {
      await trackingController.setPaused(!tracking.isPaused);
    } catch (error) {
      const message = error instanceof JourneyError ? error.message : 'Please try again.';
      Alert.alert('Could not change sharing', message);
    }
  };

  const handleNavigateToTraveler = async (target: ParticipantLiveState) => {
    if (!tracking.selfFix || target.positionKind !== 'LIVE') {
      Alert.alert('Not available', `${target.name} has no live location to navigate to yet.`);
      return;
    }
    try {
      const route = await getRoute(
        { lat: tracking.selfFix.lat, lng: tracking.selfFix.lng },
        { lat: target.lat, lng: target.lng },
        me?.travelMode ?? 'CAR'
      );
      nav.startSecondaryRouteToTraveler(target.name, route);
      setSelectedTravelerUid(null);
    } catch {
      Alert.alert('Route Failed', `Could not calculate a route to ${target.name}.`);
    }
  };

  if (!currentJourney) return <View style={styles.container} />;
  const destination = currentJourney.destination;
  const locationOff = onTheRoad && !tracking.isTracking;

  return (
    <View style={styles.container}>
      <MapLibreContainer
        destination={destination}
        participants={participants}
        selectedParticipantUid={selectedTravelerUid}
        onSelectParticipant={(id) => setSelectedTravelerUid(id)}
        routeCoordinates={nav.activeRoute?.geometry?.coordinates}
        isOverviewMode={isOverviewMode}
      >
        <View style={styles.topOverlay} pointerEvents="box-none">
          <TouchableOpacity style={styles.backPill} onPress={onBack} activeOpacity={0.8}>
            <BackIcon size={16} color="#0f172a" />
            <Text style={styles.backPillText}>Home</Text>
          </TouchableOpacity>

          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>
                You're offline. Friends see your last position; yours updates when you reconnect.
              </Text>
            </View>
          )}

          {locationOff && (
            <TouchableOpacity
              style={styles.warningBanner}
              onPress={() => {
                resumeTrackingIfNeeded().catch(() => undefined);
                Linking.openSettings().catch(() => undefined);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.warningText}>
                Location sharing is off. Tap to allow location in Settings.
              </Text>
            </TouchableOpacity>
          )}

          {onTheRoad && (
            <NextManeuverBanner
              instruction={
                nav.activeRoute?.source === 'ESTIMATE'
                  ? 'Estimated direct line: turn-by-turn directions are unavailable right now'
                  : nav.nextInstruction
              }
              distanceToManeuver={formatDistance(nav.distanceToNextManeuverM)}
              maneuverIcon={nav.maneuverIcon}
              currentRoad={tracking.currentRoad || localParticipant?.currentRoad || ''}
              isOffRoute={nav.isOffRoute}
              isSecondaryRoute={nav.isSecondaryRoute}
              secondaryTravelerName={nav.secondaryTravelerName}
              onExitSecondaryRoute={nav.exitSecondaryRoute}
            />
          )}

          {onTheRoad && (
            <QuickStatusPicker
              currentStatus={tracking.status}
              onSelectStatus={handleSelectStatus}
              onOpenEmergency={() => setIsEmergencyOpen(true)}
            />
          )}
        </View>

        <RecenterButton
          onRecenterSelf={() => {
            setIsOverviewMode(false);
            setSelectedTravelerUid(null);
          }}
          onFitAll={() => setIsOverviewMode(true)}
          isOverviewMode={isOverviewMode}
        />
      </MapLibreContainer>

      {selectedParticipant && (
        <TravelerDetailCard
          participant={selectedParticipant}
          destinationName={destination.displayName}
          onClose={() => setSelectedTravelerUid(null)}
          onNavigateToTraveler={handleNavigateToTraveler}
        />
      )}

      {!selectedParticipant && (
        <TravelerBottomSheet
          participants={participants}
          selectedUid={selectedTravelerUid}
          onSelectParticipant={(id) => setSelectedTravelerUid(id)}
          isSharingPaused={tracking.isPaused}
          canTogglePause={me?.state === 'TRAVELING' || me?.state === 'PAUSED'}
          onTogglePauseSharing={handleTogglePause}
          onOpenChat={onOpenChat}
          onOpenOfflineMap={() => setIsOfflineModalOpen(true)}
          onFinishJourney={handleLeaveOrEnd}
          isHost={isHost}
          nowMs={nowMs}
        />
      )}

      {isOfflineModalOpen && (
        <OfflineMapModal
          journeyId={currentJourney.journeyId}
          destination={destination}
          onClose={() => setIsOfflineModalOpen(false)}
        />
      )}

      {isEmergencyOpen && (
        <EmergencyActionSheet
          currentLocation={
            tracking.selfFix ? { lat: tracking.selfFix.lat, lng: tracking.selfFix.lng } : null
          }
          currentRoad={tracking.currentRoad}
          destination={destination}
          participants={participants}
          onClose={() => setIsEmergencyOpen(false)}
          onBroadcastHelpStatus={() => handleSelectStatus('NEED_HELP')}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    elevation: 3,
  },
  backPillText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  offlineBanner: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  offlineText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  warningBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  warningText: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '600',
  },
  topOverlay: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    zIndex: 30,
    gap: 12,
  },
});
