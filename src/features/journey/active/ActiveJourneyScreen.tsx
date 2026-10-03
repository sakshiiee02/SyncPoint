import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useJourneyStore } from '@/store/useJourneyStore';
import { useProfileStore } from '@/store/useProfileStore';
import {
  useLiveLocationStore,
  computeParticipantLiveState,
} from '@/store/useLiveLocationStore';
import { useNavigationStore } from '@/store/useNavigationStore';
import {
  subscribeToLiveLocations,
  setLocationSharingPaused,
  publishLiveLocation,
} from '@/services/firebase/liveLocationService';
import { subscribeToJourney } from '@/services/firebase/rtdbService';
import { LocationBridge, RawLocationUpdate } from '@/services/location/LocationBridge';
import { requestLocationPermissions } from '@/services/location/permissionService';
import { adaptiveSampler } from '@/services/location/adaptiveSamplingService';
import { getRoute } from '@/services/routing/osrmService';
import { evaluateNavigationProgress } from '@/services/routing/navigationEngine';
import { voiceGuidance } from '@/services/routing/voiceGuidanceService';
import { localDb } from '@/db/sqliteClient';
import { syncService } from '@/services/offlineMaps/reconnectSyncService';
import { MapLibreContainer } from '@/components/map/MapLibreContainer';
import { NextManeuverBanner } from './components/NextManeuverBanner';
import { RecenterButton } from '@/components/map/RecenterButton';
import { TravelerBottomSheet } from './components/TravelerBottomSheet';
import { TravelerDetailCard } from './components/TravelerDetailCard';
import { OfflineMapModal } from './components/OfflineMapModal';
import { QuickStatusPicker } from './components/QuickStatusPicker';
import { EmergencyActionSheet } from './components/EmergencyActionSheet';
import { broadcastQuickStatus } from '@/services/firebase/statusService';
import { QuickStatusType } from '@/types/status';
import { ParticipantLiveState, LiveLocationRecord } from '@/types/liveLocation';
import { isWithinRadius, calculateDistanceMeters, formatDistance } from '@/utils/geoMath';
import { CONFIG } from '@/constants/config';

interface ActiveJourneyScreenProps {
  journeyId: string;
  onExit: () => void;
  onOpenChat: () => void;
}

export const ActiveJourneyScreen: React.FC<ActiveJourneyScreenProps> = ({
  journeyId,
  onExit,
  onOpenChat,
}) => {
  const { currentJourney, members, setCurrentJourney, setMembers, updateMemberSharingState } =
    useJourneyStore();
  const { profile } = useProfileStore();
  const {
    locations,
    isSharingPaused,
    selectedTravelerUid,
    setAllLocations,
    setSharingPaused,
    setSelectedTravelerUid,
  } = useLiveLocationStore();

  const {
    activeRoute,
    distanceToNextManeuverM,
    nextInstruction,
    maneuverIcon,
    isOffRoute,
    isSecondaryRoute,
    secondaryTravelerName,
    setActiveRoute,
    updateProgress,
    startSecondaryRouteToTraveler,
    exitSecondaryRoute,
    resetNavigation,
  } = useNavigationStore();

  const [hasShownArrivalAlert, setHasShownArrivalAlert] = useState(false);
  const [isOverviewMode, setIsOverviewMode] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);

  // Broadcast quick travel status (Section 14.2 & 14.3)
  const handleSelectStatus = async (status: QuickStatusType) => {
    if (!profile?.uid || !currentJourney) return;
    try {
      await broadcastQuickStatus(
        journeyId,
        { uid: profile.uid, name: profile.name || 'Traveler' },
        status
      );
    } catch (e: any) {
      console.warn('Failed to update status:', e.message);
    }
  };

  // 1. Subscribe to Journey Metadata & Live Locations
  useEffect(() => {
    const unsubJourney = subscribeToJourney(
      journeyId,
      (meta) => setCurrentJourney(meta),
      (mems) => setMembers(mems)
    );

    const unsubLocations = subscribeToLiveLocations(journeyId, (liveMap) => {
      setAllLocations(liveMap);
    });

    return () => {
      unsubJourney();
      unsubLocations();
    };
  }, [journeyId, setCurrentJourney, setMembers, setAllLocations]);

  // 2. Initial Route Calculation with Offline SQLite Caching (Phase 5)
  useEffect(() => {
    async function loadInitialRoute() {
      if (!currentJourney || activeRoute) return;

      // Check SQLite cache first for instant offline startup
      const cached = await localDb.getCachedRoute(journeyId);
      if (cached) {
        setActiveRoute(cached);
      }

      const myMember = profile?.uid ? members[profile.uid] : undefined;
      const origin = myMember?.origin || {
        lat: 28.6139,
        lng: 77.209,
        displayName: 'Current Location',
      };
      const travelMode = myMember?.travelMode || 'CAR';

      try {
        const route = await getRoute(
          { lat: origin.lat, lng: origin.lng },
          { lat: currentJourney.destination.lat, lng: currentJourney.destination.lng },
          travelMode
        );
        setActiveRoute(route);
        await localDb.cacheRoute(journeyId, route);
      } catch (e: any) {
        console.warn('[ActiveJourney] Route fetch failed, using cached corridor:', e.message);
      }
    }

    loadInitialRoute();
  }, [currentJourney, members, profile?.uid, activeRoute, setActiveRoute, journeyId]);

  // Compute live participant states
  const participantStates: ParticipantLiveState[] = Object.values(members).map((member) => {
    const liveRecord = locations[member.uid];
    const isLocalUser = member.uid === profile?.uid;
    return computeParticipantLiveState(liveRecord, member, isLocalUser);
  });

  const localParticipant = participantStates.find((p) => p.isLocalUser);
  const selectedParticipant = participantStates.find((p) => p.uid === selectedTravelerUid);

  // 3. Navigation Evaluation & Voice Guidance on GPS Fix
  const handleGpsUpdate = useCallback(
    async (update: RawLocationUpdate) => {
      if (!profile?.uid || !currentJourney) return;

      const currentPoint = { lat: update.latitude, lng: update.longitude };

      // Evaluate turn navigation if route is loaded
      if (activeRoute) {
        const progress = evaluateNavigationProgress(currentPoint, activeRoute);
        updateProgress(progress);

        // Voice navigation prompt
        voiceGuidance.evaluateManeuverPrompt(
          progress.currentStepIndex,
          progress.distanceToNextManeuverM,
          progress.instruction
        );

        // Off-route automatic recalculation (Section 11.2 & 267)
        if (progress.isOffRoute && !isSecondaryRoute) {
          const myMember = members[profile.uid];
          getRoute(currentPoint, currentJourney.destination, myMember?.travelMode || 'CAR')
            .then((recalculated) => {
              setActiveRoute(recalculated);
              localDb.cacheRoute(journeyId, recalculated);
            })
            .catch(() => {});
        }
      }

      const distanceRemainingM = calculateDistanceMeters(
        currentPoint,
        { lat: currentJourney.destination.lat, lng: currentJourney.destination.lng }
      );

      const safeSpeedMps = Math.max(update.speedMps, 1.0);
      const etaEpochMs = Date.now() + Math.round((distanceRemainingM / safeSpeedMps) * 1000);

      const shouldPublish =
        update.shouldPublish ||
        adaptiveSampler.shouldPublish(
          update.latitude,
          update.longitude,
          update.speedMps,
          update.heading
        );

      if (shouldPublish && !isSharingPaused) {
        const liveRecord: LiveLocationRecord = {
          lat: update.latitude,
          lng: update.longitude,
          heading: update.heading,
          speedMps: update.speedMps,
          batteryPct: 90,
          status: 'ON_THE_WAY',
          lastUpdatedAt: Date.now(),
          currentRoad: activeRoute?.steps[0]?.name || 'Highway Corridor',
          distanceRemainingM: Math.round(distanceRemainingM),
          etaEpochMs,
          routeVersion: activeRoute?.routeVersion || 1,
          isSharing: true,
        };

        // Offline Buffer Handling (Section 12): buffer if disconnected, else publish directly
        const isOnline = await syncService.handleLocationUpdate(journeyId, profile.uid, liveRecord);
        if (isOnline) {
          publishLiveLocation(journeyId, profile.uid, liveRecord).catch((err) => {
            console.warn('[ActiveJourney] Live publish failed, buffering:', err.message);
            localDb.bufferLocation(journeyId, profile.uid, liveRecord);
          });
        }
      }
    },
    [
      profile?.uid,
      currentJourney,
      activeRoute,
      members,
      isSecondaryRoute,
      isSharingPaused,
      journeyId,
      setActiveRoute,
      updateProgress,
    ]
  );

  // 4. Initialize Location Service & Listeners
  useEffect(() => {
    let unsubLocationBridge: (() => void) | null = null;

    async function initTracking() {
      const hasPermission = await requestLocationPermissions();
      if (!hasPermission) return;

      const journeyTitle = currentJourney?.name || 'Road Trip';
      const destTitle = currentJourney?.destination.displayName || 'Destination';

      await LocationBridge.startTracking(journeyId, journeyTitle, destTitle);
      unsubLocationBridge = LocationBridge.addLocationListener(handleGpsUpdate);
    }

    initTracking();

    return () => {
      if (unsubLocationBridge) unsubLocationBridge();
      adaptiveSampler.reset();
      voiceGuidance.reset();
    };
  }, [journeyId, currentJourney, handleGpsUpdate]);

  // 5. Proximity / Arrival Check (Section 5.6 & 22)
  useEffect(() => {
    if (!currentJourney || !localParticipant || hasShownArrivalAlert) return;

    const arrived = isWithinRadius(
      { lat: localParticipant.lat, lng: localParticipant.lng },
      { lat: currentJourney.destination.lat, lng: currentJourney.destination.lng },
      CONFIG.ARRIVAL_RADIUS_M
    );

    if (arrived && localParticipant.lat !== 0) {
      setHasShownArrivalAlert(true);
      Alert.alert(
        "You've Arrived! 🏁",
        `You have reached ${currentJourney.destination.displayName}. Press Finish when you are done tracking.`,
        [
          { text: 'Keep Tracking', style: 'cancel' },
          {
            text: 'Finish Journey',
            style: 'destructive',
            onPress: handleFinishJourney,
          },
        ]
      );
    }
  }, [localParticipant, currentJourney, hasShownArrivalAlert]);

  // 6. Handle Secondary Route to Traveler (Section 11.3)
  const handleNavigateToTraveler = async (targetTraveler: ParticipantLiveState) => {
    if (!localParticipant) return;

    try {
      const secondaryRoute = await getRoute(
        { lat: localParticipant.lat, lng: localParticipant.lng },
        { lat: targetTraveler.lat, lng: targetTraveler.lng },
        'CAR'
      );
      startSecondaryRouteToTraveler(targetTraveler.name, secondaryRoute);
      setSelectedTravelerUid(null);
    } catch (e: any) {
      Alert.alert('Route Failed', `Could not calculate route to ${targetTraveler.name}.`);
    }
  };

  // 7. Handle Pause / Resume Location Sharing
  const handleTogglePause = async () => {
    if (!profile?.uid || !localParticipant) return;
    const nextPaused = !isSharingPaused;
    setSharingPaused(nextPaused);

    if (nextPaused) {
      await LocationBridge.pauseTracking();
    } else {
      await LocationBridge.resumeTracking();
    }

    const record: LiveLocationRecord = {
      lat: localParticipant.lat,
      lng: localParticipant.lng,
      heading: localParticipant.heading,
      speedMps: localParticipant.speedMps,
      batteryPct: localParticipant.batteryPct,
      status: localParticipant.status,
      lastUpdatedAt: Date.now(),
      currentRoad: localParticipant.currentRoad,
      distanceRemainingM: localParticipant.distanceRemainingM,
      etaEpochMs: localParticipant.etaEpochMs,
      routeVersion: localParticipant.routeVersion,
      isSharing: !nextPaused,
    };

    try {
      await setLocationSharingPaused(journeyId, profile.uid, record, nextPaused);
      updateMemberSharingState(profile.uid, nextPaused ? 'PAUSED' : 'ACTIVE');
    } catch (e: any) {
      console.warn('Failed to toggle sharing pause:', e.message);
    }
  };

  // 8. Handle Finish Journey (Section 5.6)
  const handleFinishJourney = async () => {
    await LocationBridge.finishTracking();
    resetNavigation();
    if (profile?.uid) {
      updateMemberSharingState(profile.uid, 'FINISHED');
    }
    Alert.alert('Journey Finished', 'You have ended location tracking for this trip.', [
      { text: 'OK', onPress: onExit },
    ]);
  };

  const destination = currentJourney?.destination || {
    lat: 15.3808,
    lng: 73.8314,
    displayName: 'Destination',
  };

  return (
    <View style={styles.container}>
      {/* Map Surface */}
      <MapLibreContainer
        destination={destination}
        participants={participantStates}
        selectedParticipantUid={selectedTravelerUid}
        onSelectParticipant={(uid) => setSelectedTravelerUid(uid)}
      >
        {/* Next Maneuver Banner (Section 6.4, 11.2, 11.3) */}
        <NextManeuverBanner
          instruction={nextInstruction}
          distanceToManeuver={formatDistance(distanceToNextManeuverM)}
          maneuverIcon={maneuverIcon}
          currentRoad={localParticipant?.currentRoad || 'NH 48'}
          isOffRoute={isOffRoute}
          isSecondaryRoute={isSecondaryRoute}
          secondaryTravelerName={secondaryTravelerName}
          onExitSecondaryRoute={exitSecondaryRoute}
        />

        {/* Quick Travel Status Bar (Section 14.2) */}
        <QuickStatusPicker
          currentStatus={localParticipant?.status || 'ON_THE_WAY'}
          onSelectStatus={handleSelectStatus}
          onOpenEmergency={() => setIsEmergencyOpen(true)}
        />

        {/* Floating Camera Controls */}
        <RecenterButton
          onRecenterSelf={() => {
            setIsOverviewMode(false);
            setSelectedTravelerUid(null);
          }}
          onFitAll={() => {
            setIsOverviewMode(true);
          }}
          isOverviewMode={isOverviewMode}
        />
      </MapLibreContainer>

      {/* Expanded Traveler Card if selected */}
      {selectedParticipant && (
        <TravelerDetailCard
          participant={selectedParticipant}
          destinationName={destination.displayName}
          onClose={() => setSelectedTravelerUid(null)}
          onNavigateToTraveler={handleNavigateToTraveler}
        />
      )}

      {/* Bottom Sheet Convoy Roster */}
      {!selectedParticipant && (
        <TravelerBottomSheet
          participants={participantStates}
          selectedUid={selectedTravelerUid}
          onSelectParticipant={(uid) => setSelectedTravelerUid(uid)}
          isSharingPaused={isSharingPaused}
          onTogglePauseSharing={handleTogglePause}
          onOpenChat={onOpenChat}
          onOpenOfflineMap={() => setIsOfflineModalOpen(true)}
          onFinishJourney={handleFinishJourney}
        />
      )}

      {/* Offline Map Pack Download Modal (Section 12.1) */}
      {isOfflineModalOpen && (
        <OfflineMapModal
          journeyId={journeyId}
          destination={destination}
          onClose={() => setIsOfflineModalOpen(false)}
        />
      )}

      {/* Emergency Assistance Sheet (Section 14.3) */}
      {isEmergencyOpen && (
        <EmergencyActionSheet
          currentLocation={
            localParticipant ? { lat: localParticipant.lat, lng: localParticipant.lng } : null
          }
          currentRoad={localParticipant?.currentRoad}
          destination={destination}
          participants={participantStates}
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
    backgroundColor: '#070b12',
  },
});
