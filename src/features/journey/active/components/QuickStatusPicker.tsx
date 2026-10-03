import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { QuickStatusType } from '@/types/status';
import { QUICK_STATUS_LABELS } from '@/services/firebase/statusService';

interface QuickStatusPickerProps {
  currentStatus: QuickStatusType;
  onSelectStatus: (status: QuickStatusType) => void;
  onOpenEmergency: () => void;
}

const AVAILABLE_STATUSES: QuickStatusType[] = [
  'ON_THE_WAY',
  'FUEL_STOP',
  'FOOD_STOP',
  'BREAK',
  'RESTROOM',
  'STOPPED',
  'TRAFFIC',
  'VEHICLE_PROBLEM',
  'NEED_HELP',
  'BACK_ON_ROUTE',
];

export const QuickStatusPicker: React.FC<QuickStatusPickerProps> = ({
  currentStatus,
  onSelectStatus,
  onOpenEmergency,
}) => {
  return (
    <View style={styles.floatingBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {AVAILABLE_STATUSES.map((st) => {
          const meta = QUICK_STATUS_LABELS[st];
          const isSelected = currentStatus === st;
          const isHelp = st === 'NEED_HELP';

          return (
            <TouchableOpacity
              key={st}
              style={[
                styles.chip,
                isSelected && styles.selectedChip,
                isHelp && styles.helpChip,
              ]}
              onPress={() => {
                if (isHelp) {
                  onOpenEmergency();
                } else {
                  onSelectStatus(st);
                }
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.selectedChipText,
                  isHelp && styles.helpChipText,
                ]}
              >
                {meta.icon} {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingBar: {
    position: 'absolute',
    top: 140,
    left: 16,
    right: 16,
    zIndex: 25,
  },
  scroll: {
    gap: 6,
    paddingVertical: 4,
  },
  chip: {
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectedChip: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
  },
  chipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  selectedChipText: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  helpChip: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  helpChipText: {
    color: '#f87171',
    fontWeight: '700',
  },
});
