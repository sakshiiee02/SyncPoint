import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { NavigationArrowIcon, CompassIcon } from '@/components/common/Icons';

interface RecenterButtonProps {
  onRecenterSelf: () => void;
  onFitAll: () => void;
  isOverviewMode?: boolean;
}

export const RecenterButton: React.FC<RecenterButtonProps> = ({
  onRecenterSelf,
  onFitAll,
  isOverviewMode = false,
}) => {
  return (
    <View style={styles.floatingContainer}>
      <TouchableOpacity
        style={[styles.button, isOverviewMode && styles.activeButton]}
        onPress={onFitAll}
        activeOpacity={0.8}
      >
        <CompassIcon size={18} color={isOverviewMode ? '#2563eb' : '#475569'} />
        <Text style={[styles.label, isOverviewMode && styles.activeLabel]}>Overview</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, !isOverviewMode && styles.activeButton]}
        onPress={onRecenterSelf}
        activeOpacity={0.8}
      >
        <NavigationArrowIcon size={18} color={!isOverviewMode ? '#2563eb' : '#475569'} />
        <Text style={[styles.label, !isOverviewMode && styles.activeLabel]}>Recenter</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    right: 16,
    bottom: 260,
    gap: 8,
    zIndex: 20,
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeButton: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  label: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  activeLabel: {
    color: '#2563eb',
  },
});
