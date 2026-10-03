import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useJourneyStore } from '@/store/useJourneyStore';
import { useProfileStore } from '@/store/useProfileStore';
import {
  useLiveLocationStore,
  computeParticipantLiveState,
} from '@/store/useLiveLocationStore';
import {
  subscribeToLiveLocations,
  setLocationSharingPaused,
} from '@/services/firebase/liveLocationService';
import { subscribeToJourney } from '@/services/firebase/rtdbService';
import { MapLibreContainer } from '@/components/map/MapLibreContainer';
import { NextManeuverBanner } from './components/NextManeuverBanner';
import { RecenterButton } from '@/components/map/RecenterButton';
import { TravelerBottomSheet } from './components/TravelerBottomSheet';
import { TravelerDetailCard } from './components/TravelerDetailCard';
import { ParticipantLiveState, LiveLocationRecord } from '@/types/liveLocation';
import { isWithinRadius } from '@/utils/geoMath';
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

  const [hasShownArrivalAlert, setHasShownArrivalAlert] = useState(false);
  const [isOverviewMode, setIsOverviewMode] = useState(false);

  // 1. Subscribe to Journey Metadata & Members
  useEffect(() => {
    const unsubJourney = subscribeToJourney(
      journeyId,
      (meta) => setCurrentJourney(meta),
      (mems) => setMembers(mems)
    );

    // 2. Subscribe to Live Location Telemetry
    const unsubLocations = subscribeToLiveLocations(journeyId, (liveMap) => {
      setAllLocations(liveMap);
    });

    return () => {
      unsubJourney();
      unsubLocations();
    };
  }, [journeyId, setCurrentJourney, setMembers, setAllLocations]);

  // Compute live participant states
  const participantStates: ParticipantLiveState[] = Object.values(members).map((member) => {
    const liveRecord = locations[member.uid];
    const isLocalUser = member.uid === profile?.uid;
    return computeParticipantLiveState(liveRecord, member, isLocalUser);
  });

  const localParticipant = participantStates.find((p) => p.isLocalUser);
  const selectedParticipant = participantStates.find((p) => p.uid === selectedTravelerUid);

  // 3. Proximity / Arrival Check (Section 5.6 & 22)
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

  // 4. Handle Pause / Resume Location Sharing (Section 8.5 & 22)
  const handleTogglePause = async () => {
    if (!profile?.uid || !localParticipant) return;
    const nextState = !isSharingPaused;
    setSharingPaused(nextState);

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
      isSharing: !nextState,
    };

    try {
      await setLocationSharingPaused(journeyId, profile.uid, record, nextState);
      updateMemberSharingState(profile.uid, nextState ? 'PAUSED' : 'ACTIVE');
    } catch (e: any) {
      console.warn('Failed to toggle sharing pause:', e.message);
    }
  };

  // 5. Handle Finish Journey (Section 5.6)
  const handleFinishJourney = () => {
    if (profile?.uid) {
      updateMemberSharingState(profile.uid, 'FINISHED');
    }
    Alert.alert('Journey Finished', 'You have ended location sharing for this trip.', [
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
        {/* Next Maneuver Banner (Section 6.4) */}
        <NextManeuverBanner
          instruction="Continue on highway toward destination"
          distanceToManeuver="3.2 km"
          currentRoad={localParticipant?.currentRoad || 'NH 48'}
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
          onNavigateToTraveler={(p) => {
            Alert.alert(
              'Secondary Route',
              `Navigating to ${p.name}. Common destination remains ${destination.displayName}.`
            );
          }}
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
          onFinishJourney={handleFinishJourney}
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
