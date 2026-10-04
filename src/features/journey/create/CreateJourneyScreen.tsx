import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Destination } from '@/types/journey';
import { TravelMode, OriginLocation } from '@/types/member';
import { useProfileStore } from '@/store/useProfileStore';
import { usePickedPlace } from '@/store/usePlacePickerStore';
import { createJourneyAction } from '@/session/journeyActions';
import { JourneyError } from '@/data/errors';
import {
  CURRENT_LOCATION_ORIGIN,
  PickerTarget,
  pickedToOrigin,
  placeToDestination,
} from '@/domain/placeMapping';
import { PlaceField } from '@/components/common/PlaceField';
import { ModeIcon } from '@/components/common/ModeIcon';

interface CreateJourneyScreenProps {
  onJourneyCreated: () => void;
  onPickPlace: (target: PickerTarget) => void;
  onCancel: () => void;
}

const MODES: Array<{ mode: TravelMode; label: string }> = [
  { mode: 'CAR', label: 'Car' },
  { mode: 'BIKE', label: 'Bike' },
  { mode: 'WALK', label: 'Walk' },
];

export const CreateJourneyScreen: React.FC<CreateJourneyScreenProps> = ({
  onJourneyCreated,
  onPickPlace,
  onCancel,
}) => {
  const profile = useProfileStore((s) => s.profile);

  const [journeyName, setJourneyName] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [origin, setOrigin] = useState<OriginLocation>(CURRENT_LOCATION_ORIGIN);
  const [travelMode, setTravelMode] = useState<TravelMode>('CAR');
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePickedPlace('destination', (picked) => {
    if (picked.type === 'PLACE') setDestination(placeToDestination(picked.place));
  });
  usePickedPlace('origin', (picked) => setOrigin(pickedToOrigin(picked)));

  const handleCreate = async () => {
    if (!profile) {
      Alert.alert('Profile Needed', 'Please complete your traveler profile before creating a journey.');
      return;
    }
    if (!journeyName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for this journey (e.g. Goa Road Trip).');
      return;
    }
    if (!destination) {
      Alert.alert('Destination Required', 'Choose where everyone is heading.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createJourneyAction({
        name: journeyName,
        destination,
        expiryHours,
        origin,
        travelMode,
      });
      onJourneyCreated();
    } catch (error) {
      const message =
        error instanceof JourneyError ? error.message : 'Unable to create journey. Please try again.';
      Alert.alert('Creation Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Create New Journey</Text>
        <Text style={styles.subtitle}>
          Set one common destination. Up to 10 friends can join, each from their own starting point.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Journey Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Goa Road Trip 2026"
          placeholderTextColor="#94a3b8"
          value={journeyName}
          onChangeText={setJourneyName}
          maxLength={80}
        />
      </View>

      <View style={styles.section}>
        <PlaceField
          label="Shared destination"
          value={destination?.displayName}
          detail={destination?.address}
          placeholder="Search for a city, landmark or address"
          onPress={() => onPickPlace('destination')}
        />
        <Text style={styles.helperText}>Everyone navigates to this point. It can't be changed later.</Text>
      </View>

      <View style={styles.section}>
        <PlaceField
          label="Your starting point"
          value={origin.displayName}
          detail={origin.kind === 'GPS' ? 'Taken from your GPS when you press Start' : undefined}
          placeholder="Choose a starting point"
          onPress={() => onPickPlace('origin')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Your Travel Mode</Text>
        <View style={styles.modeRow}>
          {MODES.map(({ mode, label }) => {
            const selected = travelMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.modeButton, selected && styles.modeButtonSelected]}
                onPress={() => setTravelMode(mode)}
              >
                <ModeIcon mode={mode} selected={selected} />
                <Text style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Journey Expiry</Text>
        <Text style={styles.helperText}>Live location sharing automatically stops after this duration.</Text>
        <View style={styles.chipRow}>
          {[12, 24, 48, 72].map((hours) => (
            <TouchableOpacity
              key={hours}
              style={[styles.chip, expiryHours === hours && styles.chipSelected]}
              onPress={() => setExpiryHours(hours)}
            >
              <Text style={[styles.chipText, expiryHours === hours && styles.chipTextSelected]}>{hours} Hours</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.submitButton, (!destination || isSubmitting) && styles.submitDisabled]}
          onPress={handleCreate}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Create & Open Lobby</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748b', lineHeight: 19 },
  section: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  helperText: { fontSize: 12, color: '#64748b', marginTop: 6, marginBottom: 2 },
  input: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  chipText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#2563eb', fontWeight: '700' },
  modeRow: { flexDirection: 'row', gap: 10 },
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
  modeButtonSelected: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  modeButtonText: { color: '#475569', fontSize: 13, fontWeight: '700' },
  modeButtonTextSelected: { color: '#ffffff' },
  actions: { marginTop: 10, marginBottom: 30, gap: 10 },
  submitButton: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitDisabled: { opacity: 0.55 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  cancelButton: { paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
});
