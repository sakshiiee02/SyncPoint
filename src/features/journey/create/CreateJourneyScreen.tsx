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
import { useJourneyStore } from '@/store/useJourneyStore';
import { createJourneyInDb } from '@/services/firebase/rtdbService';

interface CreateJourneyScreenProps {
  onJourneyCreated: (journeyId: string, joinCode: string) => void;
  onCancel: () => void;
}

// Popular sample destinations for road trips
const PRESET_DESTINATIONS: Destination[] = [
  {
    displayName: 'Goa International Airport (GOI)',
    lat: 15.3808,
    lng: 73.8314,
    address: 'Dabolim, Goa 403801',
  },
  {
    displayName: 'Amber Palace, Jaipur',
    lat: 26.9855,
    lng: 75.8513,
    address: 'Devisinghpura, Amer, Jaipur, Rajasthan',
  },
  {
    displayName: 'India Gate, New Delhi',
    lat: 28.6129,
    lng: 77.2295,
    address: 'Rajpath, India Gate, New Delhi',
  },
  {
    displayName: 'Gateway of India, Mumbai',
    lat: 18.9220,
    lng: 72.8347,
    address: 'Apollo Bandar, Colaba, Mumbai',
  },
];

const PRESET_ORIGINS: OriginLocation[] = [
  { displayName: 'Current GPS Location', lat: 28.6139, lng: 77.2090 },
  { displayName: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  { displayName: 'Jaipur, Rajasthan', lat: 26.9124, lng: 75.7873 },
  { displayName: 'Gwalior, MP', lat: 26.2183, lng: 78.1828 },
  { displayName: 'Mumbai, Maharashtra', lat: 19.0760, lng: 72.8777 },
];

export const CreateJourneyScreen: React.FC<CreateJourneyScreenProps> = ({
  onJourneyCreated,
  onCancel,
}) => {
  const { profile } = useProfileStore();
  const { setActiveJoinCode } = useJourneyStore();

  const [journeyName, setJourneyName] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<Destination>(PRESET_DESTINATIONS[0]);
  const [selectedOrigin, setSelectedOrigin] = useState<OriginLocation>(PRESET_ORIGINS[0]);
  const [travelMode, setTravelMode] = useState<TravelMode>('CAR');
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!profile || !profile.uid) {
      Alert.alert('Profile Needed', 'Please complete your traveler profile before creating a journey.');
      return;
    }
    if (!journeyName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for this journey (e.g. Goa Road Trip).');
      return;
    }

    try {
      setIsSubmitting(true);
      const { journeyId, joinCode } = await createJourneyInDb(
        {
          uid: profile.uid,
          name: profile.name,
          username: profile.username,
          phone: profile.phone,
          photoUrl: profile.photoUrl,
        },
        journeyName,
        selectedDestination,
        expiryHours,
        selectedOrigin,
        travelMode
      );

      setActiveJoinCode(joinCode);
      setIsSubmitting(false);
      onJourneyCreated(journeyId, joinCode);
    } catch (error: any) {
      setIsSubmitting(false);
      Alert.alert('Creation Failed', error?.message || 'Unable to create journey. Please check connection.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create New Journey</Text>
        <Text style={styles.subtitle}>
          Set one common destination for your convoy. Up to 10 friends can join with their own origins.
        </Text>
      </View>

      {/* Journey Name */}
      <View style={styles.section}>
        <Text style={styles.label}>Journey Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Goa Trip 2026"
          placeholderTextColor="#64748b"
          value={journeyName}
          onChangeText={setJourneyName}
        />
      </View>

      {/* Destination Selection */}
      <View style={styles.section}>
        <Text style={styles.label}>Shared Common Destination</Text>
        <Text style={styles.helperText}>All participants will navigate toward this sync point.</Text>
        {PRESET_DESTINATIONS.map((dest, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.optionCard,
              selectedDestination.displayName === dest.displayName && styles.optionCardSelected,
            ]}
            onPress={() => setSelectedDestination(dest)}
          >
            <Text style={styles.optionTitle}>{dest.displayName}</Text>
            <Text style={styles.optionSubtitle}>{dest.address}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Creator Origin */}
      <View style={styles.section}>
        <Text style={styles.label}>Your Starting Point</Text>
        <View style={styles.chipRow}>
          {PRESET_ORIGINS.map((orig, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.chip,
                selectedOrigin.displayName === orig.displayName && styles.chipSelected,
              ]}
              onPress={() => setSelectedOrigin(orig)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedOrigin.displayName === orig.displayName && styles.chipTextSelected,
                ]}
              >
                {orig.displayName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Travel Mode */}
      <View style={styles.section}>
        <Text style={styles.label}>Your Travel Mode</Text>
        <View style={styles.modeRow}>
          {(['CAR', 'BIKE', 'WALK'] as TravelMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.modeButton, travelMode === mode && styles.modeButtonSelected]}
              onPress={() => setTravelMode(mode)}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  travelMode === mode && styles.modeButtonTextSelected,
                ]}
              >
                {mode === 'CAR' ? '🚗 Car' : mode === 'BIKE' ? '🏍️ Bike' : '🚶 Walk'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Expiry Selector (Section 5.2 & 120) */}
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
              <Text style={[styles.chipText, expiryHours === hours && styles.chipTextSelected]}>
                {hours} Hours
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.submitButton}
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
  container: {
    padding: 20,
    backgroundColor: '#090d16',
    flexGrow: 1,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111827',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  optionCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  optionCardSelected: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  chipSelected: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modeButtonSelected: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  modeButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  modeButtonTextSelected: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  actions: {
    marginTop: 10,
    marginBottom: 30,
    gap: 10,
  },
  submitButton: {
    backgroundColor: '#06b6d4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
});
