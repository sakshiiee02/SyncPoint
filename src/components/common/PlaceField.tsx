import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRightIcon, PinIcon } from './Icons';

interface PlaceFieldProps {
  label: string;
  /** Selected place name; when empty the placeholder is shown. */
  value?: string;
  detail?: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}

/** A tappable "choose a place" row used for destination and starting point. */
export const PlaceField: React.FC<PlaceFieldProps> = ({
  label,
  value,
  detail,
  placeholder,
  onPress,
  disabled,
}) => (
  <TouchableOpacity
    style={[styles.card, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.8}
  >
    <PinIcon size={18} color={value ? '#2563eb' : '#94a3b8'} />
    <View style={styles.text}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      {!!detail && (
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      )}
    </View>
    {!disabled && <ChevronRightIcon size={18} color="#94a3b8" />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  disabled: { opacity: 0.6 },
  text: { flex: 1 },
  label: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  placeholder: { color: '#94a3b8', fontWeight: '600' },
  detail: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
