import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { lookupJourneyByCode } from '@/services/firebase/rtdbService';
import { JourneyMeta } from '@/types/journey';

interface JoinJourneyScreenProps {
  onJourneyResolved: (journey: JourneyMeta, code: string) => void;
  onCancel: () => void;
}

export const JoinJourneyScreen: React.FC<JoinJourneyScreenProps> = ({
  onJourneyResolved,
  onCancel,
}) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resolvedJourney, setResolvedJourney] = useState<JourneyMeta | null>(null);

  const handleLookup = async () => {
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length < 4) {
      Alert.alert('Code Needed', 'Please enter a valid 6-character journey invite code.');
      return;
    }

    try {
      setIsLoading(true);
      const journey = await lookupJourneyByCode(cleanCode);
      setIsLoading(false);

      if (!journey) {
        Alert.alert('Not Found', 'No active journey found with this code. Check the code and try again.');
        return;
      }

      setResolvedJourney(journey);
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Lookup Error', error?.message || 'Could not verify code.');
    }
  };

  const handleConfirmJoin = () => {
    if (resolvedJourney) {
      onJourneyResolved(resolvedJourney, code.trim().toUpperCase());
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Join a Journey</Text>
        <Text style={styles.subtitle}>
          Enter the 6-character short code shared by your trip creator.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Invite Code</Text>
        <TextInput
          style={styles.codeInput}
          placeholder="e.g. GOA42K"
          placeholderTextColor="#64748b"
          value={code}
          onChangeText={(val: string) => {
            setCode(val.toUpperCase());
            setResolvedJourney(null);
          }}
          autoCapitalize="characters"
          maxLength={8}
        />

        {!resolvedJourney ? (
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleLookup}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.searchButtonText}>Verify Code</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.previewBox}>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>JOURNEY FOUND</Text>
            </View>
            <Text style={styles.journeyName}>{resolvedJourney.name}</Text>
            <Text style={styles.destination}>
              Destination: {resolvedJourney.destination.displayName}
            </Text>
            <Text style={styles.memberCount}>
              Current travelers: {resolvedJourney.memberCount}/10
            </Text>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmJoin}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmButtonText}>Continue to Origin Selection →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  codeInput: {
    backgroundColor: '#1e293b',
    color: '#38bdf8',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: '#06b6d4',
    marginBottom: 16,
  },
  searchButton: {
    backgroundColor: '#06b6d4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  previewBox: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#06b6d4',
  },
  previewBadge: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  previewBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  journeyName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  destination: {
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 14,
  },
  confirmButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
});
