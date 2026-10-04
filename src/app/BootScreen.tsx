import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BootState } from './useBootstrap';

interface BootScreenProps {
  state: Exclude<BootState, { status: 'ready' }>;
  onRetry: () => void;
}

export const BootScreen: React.FC<BootScreenProps> = ({ state, onRetry }) => {
  if (state.status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  const isConfig = state.status === 'config-error';
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isConfig ? 'App not configured' : "Can't connect"}</Text>
      <Text style={styles.body}>
        {isConfig
          ? `This build is missing Firebase settings:\n${state.missing.join('\n')}\n\nAdd them to .env and rebuild.`
          : state.message}
      </Text>
      {!isConfig && (
        <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  body: { color: '#94a3b8', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
