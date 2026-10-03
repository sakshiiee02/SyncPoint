import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useProfileStore } from '@/store/useProfileStore';

interface ProfileScreenProps {
  onSaved?: () => void;
  isFirstLaunch?: boolean;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onSaved, isFirstLaunch }) => {
  const { profile, saveProfile } = useProfileStore();

  const [name, setName] = useState(profile?.name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [phone, setPhone] = useState(profile?.phone || '');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your display name.');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Required', 'Please choose a username handle.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter your phone number so journey members can reach you.');
      return;
    }

    saveProfile(name, username, phone);
    Alert.alert('Profile Saved', 'Your traveler profile is ready.', [
      { text: 'Continue', onPress: () => onSaved?.() },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{isFirstLaunch ? 'Welcome to SyncPoint' : 'Your Traveler Profile'}</Text>
        <Text style={styles.subtitle}>
          No passwords or email needed. Just set your travel handle and contact info for your group.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Shashank Verma"
          placeholderTextColor="#64748b"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Username Handle</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. shashank_v"
          placeholderTextColor="#64748b"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="+91 98765 43210"
          placeholderTextColor="#64748b"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        {/* Explicit Phone Disclosure from Section 5.3 & 16.4 */}
        <View style={styles.disclosureBox}>
          <Text style={styles.disclosureTitle}>Phone Number Visibility</Text>
          <Text style={styles.disclosureText}>
            Your phone number will be visible to members of your journey so they can directly call you
            during the road trip for coordination. It is never displayed publicly or to non-members.
          </Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSave} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Save Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
    marginBottom: 8,
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
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  disclosureBox: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#06b6d4',
    padding: 12,
    borderRadius: 8,
    marginTop: 18,
    marginBottom: 20,
  },
  disclosureTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  disclosureText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#06b6d4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
