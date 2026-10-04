import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { TravelMode, OriginLocation } from '@/types/member';
import { useProfileStore } from '@/store/useProfileStore';
import { joinJourneyAction } from '@/session/journeyActions';
import { usePickedPlace } from '@/store/usePlacePickerStore';
import { CURRENT_LOCATION_ORIGIN, PickerTarget, pickedToOrigin } from '@/domain/placeMapping';
import { PlaceField } from '@/components/common/PlaceField';
import { JourneyError } from '@/data/errors';
import { useJourneyStore } from '@/store/useJourneyStore';
import { CarIcon, BikeIcon, WalkIcon } from '@/components/common/Icons';

interface OriginTravelModeScreenProps {
  journeyId: string;
  journeyName: string;
  destinationName: string;
  onJoined: () => void;
  /** Offered when the user already belongs to another active journey. */
  onResumeExisting: () => void;
  onPickPlace: (target: PickerTarget) => void;
  onCancel: () => void;
}

export const OriginTravelModeScreen: React.FC<OriginTravelModeScreenProps> = ({
  journeyId,
  journeyName,
  destinationName,
  onJoined,
  onResumeExisting,
  onPickPlace,
  onCancel,
}) => {
  const { profile } = useProfileStore();

  const [selectedOrigin, setSelectedOrigin] = useState<OriginLocation>(CURRENT_LOCATION_ORIGIN);
  const [travelMode, setTravelMode] = useState<TravelMode>('CAR');
  const [isJoining, setIsJoining] = useState(false);

  usePickedPlace('origin', (picked) => setSelectedOrigin(pickedToOrigin(picked)));

  const handleJoin = async () => {
    if (!profile) {
      Alert.alert('Profile Incomplete', 'Please ensure your profile is filled before joining.');
      return;
    }

    try {
      setIsJoining(true);
      await joinJourneyAction(journeyId, { origin: selectedOrigin, travelMode });
      onJoined();
    } catch (error) {
      if (error instanceof JourneyError && error.code === 'ALREADY_IN_JOURNEY') {
        const hasLocalJourney = useJourneyStore.getState().activeJourneyId !== null;
        Alert.alert(
          'Already in a journey',
          error.message,
          hasLocalJourney
            ? [{ text: 'Not now', style: 'cancel' }, { text: 'Open my journey', onPress: onResumeExisting }]
            : [{ text: 'OK' }]
        );
      } else {
        const message = error instanceof JourneyError ? error.message : 'Could not join journey.';
        Alert.alert('Join Failed', message);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const renderModeIcon = (mode: TravelMode, isSelected: boolean) => {
    const color = isSelected ? '#ffffff' : '#475569';
    switch (mode) {
      case 'CAR':
        return <CarIcon size={20} color={color} />;
      case 'BIKE':
        return <BikeIcon size={20} color={color} />;
      case 'WALK':
        return <WalkIcon size={20} color={color} />;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trip Setup: {journeyName}</Text>
        <Text style={styles.subtitle}>
          All travelers head to <Text style={styles.bold}>{destinationName}</Text>. Select your
          individual origin and vehicle mode.
        </Text>
      </View>

      {/* Route Overview Card (Matching Screenshot 4: Origin A & Destination B) */}
      <View style={styles.routeBox}>
        <View style={styles.pointRow}>
          <View style={styles.pointCircleA}>
            <Text style={styles.pointLetter}>A</Text>
          </View>
          <View style={styles.pointTextContainer}>
            <Text style={styles.pointLabel}>Origin (Your Starting Point)</Text>
            <Text style={styles.pointValue}>{selectedOrigin.displayName}</Text>
          </View>
        </View>

        <View style={styles.pointDivider} />

        <View style={styles.pointRow}>
          <View style={styles.pointCircleB}>
            <Text style={styles.pointLetter}>B</Text>
          </View>
          <View style={styles.pointTextContainer}>
            <Text style={styles.pointLabel}>Destination (Convoy Target)</Text>
            <Text style={styles.pointValue}>{destinationName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <PlaceField
          label="Your starting point"
          value={selectedOrigin.displayName}
          detail={selectedOrigin.kind === 'GPS' ? 'Taken from your GPS when you press Start' : undefined}
          placeholder="Choose a starting point"
          onPress={() => onPickPlace('origin')}
        />
        <Text style={styles.originHint}>You can change this in the lobby until you press Start.</Text>
      </View>

      {/* Travel Mode Selection (Zero Emojis, Pure SVG Vector Icons) */}
      <View style={styles.section}>
        <Text style={styles.label}>Travel Mode</Text>
        <View style={styles.modeRow}>
          {(['CAR', 'BIKE', 'WALK'] as TravelMode[]).map((mode) => {
            const isSelected = travelMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.modeButton, isSelected && styles.modeButtonSelected]}
                onPress={() => setTravelMode(mode)}
              >
                {renderModeIcon(mode, isSelected)}
                <Text
                  style={[
                    styles.modeButtonText,
                    isSelected && styles.modeButtonTextSelected,
                  ]}
                >
                  {mode === 'CAR' ? 'Car' : mode === 'BIKE' ? 'Bike' : 'Walk'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Privacy Notice from Section 5.3 & 16.4 */}
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Group Coordination Consent</Text>
        <Text style={styles.noticeText}>
          By entering this lobby, your profile name and phone number will be visible to fellow journey
          members so they can call you or check your arrival progress.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.joinButton}
        onPress={handleJoin}
        disabled={isJoining}
        activeOpacity={0.8}
      >
        {isJoining ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.joinButtonText}>Confirm & Enter Convoy Lobby</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8fafc',
    flexGrow: 1,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  bold: {
    color: '#2563eb',
    fontWeight: '700',
  },
  routeBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pointCircleA: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointCircleB: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointLetter: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  pointTextContainer: {
    flex: 1,
  },
  pointLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pointValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  pointDivider: {
    height: 16,
    width: 2,
    backgroundColor: '#e2e8f0',
    marginLeft: 15,
    marginVertical: 4,
  },
  originHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  chipText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#2563eb',
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  modeButtonSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  modeButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  modeButtonTextSelected: {
    color: '#ffffff',
  },
  noticeBox: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noticeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  joinButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
});
