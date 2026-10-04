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
import { AlertTriangleIcon, PhoneIcon, ShareIcon } from '@/components/common/Icons';

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
          <View style={styles.alertIconWrap}>
            <AlertTriangleIcon size={24} color="#dc2626" />
          </View>
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

        {/* Primary Action Buttons (Zero Emojis, Crisp MNC styling) */}
        <View style={styles.actionsList}>
          {/* 1. Broadcast Urgent Alert to Convoy */}
          <TouchableOpacity
            style={styles.convoyHelpButton}
            onPress={handleBroadcastConvoyHelp}
            activeOpacity={0.8}
          >
            <AlertTriangleIcon size={18} color="#ffffff" />
            <Text style={styles.convoyHelpText}>Broadcast Help Alert to Convoy</Text>
          </TouchableOpacity>

          {/* 2. Call Emergency Services (112) */}
          <TouchableOpacity
            style={styles.sosButton}
            onPress={handleCallEmergencyServices}
            activeOpacity={0.8}
          >
            <PhoneIcon size={18} color="#ffffff" />
            <Text style={styles.sosButtonText}>Call Emergency Services (112)</Text>
          </TouchableOpacity>

          {/* 3. Share Outside Apps */}
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareExternalLocation}
            activeOpacity={0.8}
          >
            <ShareIcon size={16} color="#0f172a" />
            <Text style={styles.shareButtonText}>Share Live GPS Link</Text>
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
                  <PhoneIcon size={12} color="#2563eb" />
                  <Text style={styles.travelerChipText}>{p.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Mandatory Disclaimer (Section 14.3) */}
        <Text style={styles.disclaimerText}>
          This emergency feature is a convoy coordination convenience. In case of life-threatening
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
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 60,
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  alertIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  alertSub: {
    fontSize: 12,
    color: '#64748b',
  },
  locationBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  locationRoad: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  locationCoords: {
    fontSize: 12,
    color: '#2563eb',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionsList: {
    gap: 10,
    marginBottom: 16,
  },
  convoyHelpButton: {
    backgroundColor: '#d97706',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  convoyHelpText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  sosButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  shareButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  shareButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  travelersList: {
    marginBottom: 16,
  },
  travelersLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  travelerChip: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  travelerChipText: {
    color: '#2563eb',
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
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
});
