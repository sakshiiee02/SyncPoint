import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { lookupJourneyByCode } from '@/data/journeyRepository';
import { JourneyError } from '@/data/errors';
import { normalizeJoinCode } from '@/domain/joinCode';
import { getFirebaseDb } from '@/services/firebase/firebaseApp';
import { CONFIG } from '@/constants/config';
import { JourneyPreview } from '@/types/journey';
import { PinIcon, UserIcon } from '@/components/common/Icons';

interface JoinJourneyScreenProps {
  /** Code from an invite link; looked up automatically. */
  initialCode?: string;
  onJourneyResolved: (preview: JourneyPreview) => void;
  onCancel: () => void;
}

export const JoinJourneyScreen: React.FC<JoinJourneyScreenProps> = ({
  initialCode,
  onJourneyResolved,
  onCancel,
}) => {
  const [code, setCode] = useState(initialCode ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<JourneyPreview | null>(null);

  const handleLookup = async (rawCode: string = code) => {
    const cleanCode = normalizeJoinCode(rawCode);
    if (cleanCode.length !== CONFIG.JOIN_CODE.LENGTH) {
      Alert.alert('Code Needed', `Please enter the ${CONFIG.JOIN_CODE.LENGTH}-character journey code.`);
      return;
    }

    try {
      setIsLoading(true);
      setPreview(await lookupJourneyByCode(getFirebaseDb(), cleanCode));
    } catch (error) {
      const message = error instanceof JourneyError ? error.message : 'Could not verify code.';
      Alert.alert('Cannot Join', message);
    } finally {
      setIsLoading(false);
    }
  };

  // Opened from an invite link: verify straight away.
  useEffect(() => {
    if (initialCode) handleLookup(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Join a Journey</Text>
        <Text style={styles.subtitle}>
          Enter the {CONFIG.JOIN_CODE.LENGTH}-character code shared by your trip creator.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Invite Code</Text>
        <TextInput
          style={styles.codeInput}
          placeholder="e.g. GOA42K"
          placeholderTextColor="#94a3b8"
          value={code}
          onChangeText={(val: string) => {
            setCode(val.toUpperCase());
            setPreview(null);
          }}
          autoCapitalize="characters"
          maxLength={8}
        />

        {!preview ? (
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => handleLookup()}
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
            <Text style={styles.journeyName}>{preview.meta.name}</Text>
            <View style={styles.detailRow}>
              <PinIcon size={14} color="#64748b" />
              <Text style={styles.destination}>
                {preview.meta.destination.displayName}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <UserIcon size={14} color="#64748b" />
              <Text style={styles.memberCount}>
                Current travelers: {preview.seatsTaken}/{CONFIG.MAX_MEMBERS}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => onJourneyResolved(preview)}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmButtonText}>Continue to Origin Selection</Text>
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
    backgroundColor: '#f8fafc',
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  codeInput: {
    backgroundColor: '#f8fafc',
    color: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    marginBottom: 16,
  },
  searchButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  previewBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  previewBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  destination: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  memberCount: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
  },
  confirmButton: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
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
    fontWeight: '600',
  },
});
