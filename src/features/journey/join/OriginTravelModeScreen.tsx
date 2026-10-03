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
import { Destination } from '@/types/journey';
import { TravelMode, OriginLocation } from '@/types/member';
import { useProfileStore } from '@/store/useProfileStore';
import { joinJourneyInDb } from '@/services/firebase/rtdbService';

interface OriginTravelModeScreenProps {
  journeyId: string;
  journeyName: string;
  destination: Destination;
  onJoined: () => void;
  onCancel: () => void;
}

const PRESET_ORIGINS: OriginLocation[] = [
  { displayName: 'Current GPS Location', lat: 28.6139, lng: 77.2090 },
  { displayName: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  { displayName: 'Jaipur, Rajasthan', lat: 26.9124, lng: 75.7873 },
  { displayName: 'Gwalior, MP', lat: 26.2183, lng: 78.1828 },
  { displayName: 'Mumbai, Maharashtra', lat: 19.0760, lng: 72.8777 },
];

export const OriginTravelModeScreen: React.FC<OriginTravelModeScreenProps> = ({
  journeyId,
  journeyName,
  destination,
  onJoined,
  onCancel,
}) => {
  const { profile } = useProfileStore();

  const [selectedOrigin, setSelectedOrigin] = useState<OriginLocation>(PRESET_ORIGINS[0]);
  const [travelMode, setTravelMode] = useState<TravelMode>('CAR');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!profile || !profile.uid) {
      Alert.alert('Profile Incomplete', 'Please ensure your profile is filled before joining.');
      return;
    }

    try {
      setIsJoining(true);
      await joinJourneyInDb(
        {
          uid: profile.uid,
          name: profile.name,
          username: profile.username,
          phone: profile.phone,
          photoUrl: profile.photoUrl,
        },
        journeyId,
        selectedOrigin,
        travelMode
      );
      setIsJoining(false);
      onJoined();
    } catch (error: any) {
      setIsJoining(false);
      Alert.alert('Join Failed', error?.message || 'Could not join journey.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trip Setup: {journeyName}</Text>
        <Text style={styles.subtitle}>
          All travelers head to <Text style={styles.bold}>{destination.displayName}</Text>. Select your
          individual origin and vehicle mode.
        </Text>
      </View>

      {/* Origin Selection */}
      <View style={styles.section}>
        <Text style={styles.label}>Your Starting Location</Text>
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

      {/* Travel Mode Selection */}
      <View style={styles.section}>
        <Text style={styles.label}>Travel Mode</Text>
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
          <Text style={styles.joinButtonText}>Confirm & Enter Lobby</Text>
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
    backgroundColor: '#090d16',
    flexGrow: 1,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  bold: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
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
    paddingVertical: 14,
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
  noticeBox: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#06b6d4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  noticeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
  joinButton: {
    backgroundColor: '#06b6d4',
    borderRadius: 12,
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
  },
});
