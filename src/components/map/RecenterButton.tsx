import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';

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
        <Text style={styles.icon}>🌐</Text>
        <Text style={styles.label}>Overview</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, !isOverviewMode && styles.activeButton]}
        onPress={onRecenterSelf}
        activeOpacity={0.8}
      >
        <Text style={styles.icon}>🎯</Text>
        <Text style={styles.label}>Recenter</Text>
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
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  activeButton: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  icon: {
    fontSize: 14,
  },
  label: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
});
