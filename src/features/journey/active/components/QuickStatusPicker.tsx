import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { QuickStatusType } from '@/types/status';
import { QUICK_STATUS_LABELS } from '@/services/firebase/statusService';
import {
  CarIcon,
  GasPumpIcon,
  RestaurantIcon,
  CoffeeIcon,
  TrafficIcon,
  AlertTriangleIcon,
  RouteIcon,
  PauseIcon,
  UserIcon,
} from '@/components/common/Icons';

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
  const renderStatusIcon = (st: QuickStatusType, isSelected: boolean, isHelp: boolean) => {
    const iconColor = isSelected ? '#ffffff' : isHelp ? '#dc2626' : '#475569';
    const iconSize = 14;

    switch (st) {
      case 'ON_THE_WAY':
        return <CarIcon size={iconSize} color={iconColor} />;
      case 'FUEL_STOP':
        return <GasPumpIcon size={iconSize} color={iconColor} />;
      case 'FOOD_STOP':
        return <RestaurantIcon size={iconSize} color={iconColor} />;
      case 'BREAK':
        return <CoffeeIcon size={iconSize} color={iconColor} />;
      case 'RESTROOM':
        return <UserIcon size={iconSize} color={iconColor} />;
      case 'STOPPED':
        return <PauseIcon size={iconSize} color={iconColor} />;
      case 'TRAFFIC':
        return <TrafficIcon size={iconSize} color={iconColor} />;
      case 'VEHICLE_PROBLEM':
      case 'NEED_HELP':
        return <AlertTriangleIcon size={iconSize} color={iconColor} />;
      case 'BACK_ON_ROUTE':
        return <RouteIcon size={iconSize} color={iconColor} />;
      default:
        return <CarIcon size={iconSize} color={iconColor} />;
    }
  };

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
                isHelp && !isSelected && styles.helpChip,
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
              <View style={styles.chipContent}>
                {renderStatusIcon(st, isSelected, isHelp)}
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.selectedChipText,
                    isHelp && !isSelected && styles.helpChipText,
                  ]}
                >
                  {meta.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingBar: {
    width: '100%',
  },
  scroll: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedChip: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  chipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedChipText: {
    color: '#ffffff',
  },
  helpChip: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  helpChipText: {
    color: '#dc2626',
  },
});
