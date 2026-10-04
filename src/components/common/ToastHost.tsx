import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { JourneyEvent } from '@/domain/journeyEvents';
import { useToastStore } from '@/store/useToastStore';

const VISIBLE_MS = 5000;
const URGENT_VISIBLE_MS = 12000;

const ToastItem: React.FC<{ event: JourneyEvent }> = ({ event }) => {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = setTimeout(
      () => dismiss(event.id),
      event.severity === 'urgent' ? URGENT_VISIBLE_MS : VISIBLE_MS
    );
    return () => clearTimeout(timer);
  }, [event, dismiss]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => dismiss(event.id)}
      style={[
        styles.toast,
        event.severity === 'warning' && styles.warning,
        event.severity === 'urgent' && styles.urgent,
      ]}
    >
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.message}>{event.message}</Text>
    </TouchableOpacity>
  );
};

/** Banners for journey events (joined, arrived, needs help, low battery…). Mount once, above screens. */
export const ToastHost: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <View style={styles.host} pointerEvents="box-none">
      {toasts.map((event) => (
        <ToastItem key={event.id} event={event} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 44, left: 12, right: 12, gap: 8, zIndex: 1000 },
  toast: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    elevation: 8,
  },
  warning: { backgroundColor: '#b45309' },
  urgent: { backgroundColor: '#b91c1c' },
  title: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  message: { color: '#e2e8f0', fontSize: 13, marginTop: 2 },
});
