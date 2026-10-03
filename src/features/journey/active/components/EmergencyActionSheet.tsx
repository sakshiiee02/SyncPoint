import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { ParticipantLiveState } from '@/types/liveLocation';
import { Destination } from '@/types/journey';

interface EmergencyActionSheetProps {
  currentLocation: { lat: number; lng: number } | null;
  currentRoad?: string;
  destination: Destination;
  participants: ParticipantLiveState[];
  onClose: () => void;
  onBroadcastHelpStatus: () => void;
}

export const EmergencyActionSheet: React.FC<EmergencyActionSheetProps> = ({
  currentLocation,
  currentRoad = 'Highway Corridor',
  destination,
  participants,
  onClose,
  onBroadcastHelpStatus,
}) => {
  const otherParticipants = participants.filter((p) => !p.isLocalUser);

  const handleCallEmergencyServices = () => {
    // 112 is the universal all-in-one emergency number in India & international
    Linking.openURL('tel:112').catch(() => {
      Alert.alert('Emergency Call', 'Dial 112 directly from your phone.');
    });
  };

  const handleCallTraveler = (phone: string, name: string) => {
    if (!phone) {
      Alert.alert('No Number', `No phone registered for ${name}.`);
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleShareExternalLocation = async () => {
    if (!currentLocation) return;
    const mapUrl = `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`;
    try {
      await Share.share({
        title: 'Emergency Assistance Needed',
        message: `I need help on the road to ${destination.displayName}! My current location (${currentRoad}): ${mapUrl}`,
      });
    } catch (e: any) {
      Alert.alert('Share Error', e.message);
    }
  };

  const handleBroadcastConvoyHelp = () => {
    onBroadcastHelpStatus();
    Alert.alert('Alert Broadcast', 'An urgent assistance alert was dispatched to your convoy.');
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.sheetContainer}>
        {/* Header Alert */}
        <View style={styles.alertHeader}>
          <Text style={styles.alertIcon}>🚨</Text>
          <View>
            <Text style={styles.alertTitle}>Need Assistance?</Text>
            <Text style={styles.alertSub}>Immediate convoy alerts & emergency dialing</Text>
          </View>
        </View>

        {/* Current Location Badge */}
        <View style={styles.locationBox}>
          <Text style={styles.locationLabel}>Your Current Position</Text>
          <Text style={styles.locationRoad}>{currentRoad}</Text>
          {currentLocation ? (
            <Text style={styles.locationCoords}>
              {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.locationCoords}>Locating GPS...</Text>
          )}
        </View>

        {/* Primary Action Buttons */}
        <View style={styles.actionsList}>
          {/* 1. Broadcast Urgent Alert to Convoy */}
          <TouchableOpacity
            style={styles.convoyHelpButton}
            onPress={handleBroadcastConvoyHelp}
            activeOpacity={0.8}
          >
            <Text style={styles.convoyHelpText}>📢 Broadcast "Need Help" to Convoy</Text>
          </TouchableOpacity>

          {/* 2. Call Emergency Services (112) */}
          <TouchableOpacity
            style={styles.sosButton}
            onPress={handleCallEmergencyServices}
            activeOpacity={0.8}
          >
            <Text style={styles.sosButtonText}>📞 Call Emergency Services (112)</Text>
          </TouchableOpacity>

          {/* 3. Share Outside Apps */}
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareExternalLocation}
            activeOpacity={0.8}
          >
            <Text style={styles.shareButtonText}>📍 Share Live GPS Link</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Call Convoy Traveler */}
        {otherParticipants.length > 0 && (
          <View style={styles.travelersList}>
            <Text style={styles.travelersLabel}>Quick Call Convoy Friend:</Text>
            <View style={styles.chipsRow}>
              {otherParticipants.slice(0, 3).map((p) => (
                <TouchableOpacity
                  key={p.uid}
                  style={styles.travelerChip}
                  onPress={() => handleCallTraveler(p.phone, p.name)}
                >
                  <Text style={styles.travelerChipText}>📞 {p.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Mandatory Disclaimer (Section 14.3) */}
        <Text style={styles.disclaimerText}>
          ⚠️ This emergency feature is a convoy coordination convenience. In case of life-threatening
          accidents or medical emergencies, always call emergency services (112 / 108) immediately.
        </Text>

        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Cancel / Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
    zIndex: 60,
  },
  sheetContainer: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 2,
    borderColor: '#ef4444',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  alertIcon: {
    fontSize: 28,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
  },
  alertSub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  locationBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  locationLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  locationRoad: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 2,
  },
  locationCoords: {
    fontSize: 12,
    color: '#06b6d4',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionsList: {
    gap: 10,
    marginBottom: 16,
  },
  convoyHelpButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  convoyHelpText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  sosButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  shareButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  shareButtonText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  travelersList: {
    marginBottom: 16,
  },
  travelersLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  travelerChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  travelerChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 14,
  },
  cancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
});
