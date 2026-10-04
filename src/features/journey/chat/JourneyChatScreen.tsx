import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChatMessage } from '@/types/chat';
import { QuickStatusType } from '@/types/status';
import { useProfileStore } from '@/store/useProfileStore';
import {
  sendChatMessage,
  subscribeToChatMessages,
  getPendingChat,
  flushChatOutbox,
} from '@/services/firebase/chatService';
import {
  broadcastQuickStatus,
  QUICK_STATUS_LABELS,
} from '@/services/firebase/statusService';
import { formatRecency } from '@/utils/timeFormat';
import { trackingController } from '@/tracking/trackingController';
import {
  CloseIcon,
  SendIcon,
  GasPumpIcon,
  RestaurantIcon,
  CoffeeIcon,
  TrafficIcon,
  AlertTriangleIcon,
} from '@/components/common/Icons';

interface JourneyChatScreenProps {
  journeyId: string;
  journeyName: string;
  onClose: () => void;
  onOpenEmergency: () => void;
}

const CHAT_STATUS_SHORTCUTS: QuickStatusType[] = [
  'FUEL_STOP',
  'FOOD_STOP',
  'BREAK',
  'TRAFFIC',
  'NEED_HELP',
];

export const JourneyChatScreen: React.FC<JourneyChatScreenProps> = ({
  journeyId,
  journeyName,
  onClose,
  onOpenEmergency,
}) => {
  const { profile } = useProfileStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Messages typed while offline stay visible (marked "sending") until the server has them.
  useEffect(() => {
    getPendingChat(journeyId).then(setPending);
    flushChatOutbox(journeyId).catch(() => undefined);
  }, [journeyId]);

  const shown = [...messages, ...pending.filter((p) => !messages.some((m) => m.id === p.id))].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  const pendingIds = new Set(pending.map((p) => p.id));

  useEffect(() => {
    const unsubscribe = subscribeToChatMessages(journeyId, (msgs) => {
      setMessages(msgs);
      setPending((current) => current.filter((p) => !msgs.some((m) => m.id === p.id)));
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => unsubscribe();
  }, [journeyId]);

  const handleSend = async () => {
    if (!inputText.trim() || !profile?.uid) return;
    const text = inputText;
    setInputText('');

    try {
      const result = await sendChatMessage(
        journeyId,
        { uid: profile.uid, name: profile.name || 'Traveler' },
        text,
        'TEXT'
      );
      if (result.queued) setPending((current) => [...current, result.message]);
    } catch (e: any) {
      console.warn('Failed to send message:', e.message);
    }
  };

  const handleQuickStatus = async (status: QuickStatusType) => {
    if (!profile?.uid) return;
    if (status === 'NEED_HELP') {
      onOpenEmergency();
      return;
    }

    try {
      await trackingController.setStatus(status);
      await broadcastQuickStatus(
        journeyId,
        { uid: profile.uid, name: profile.name || 'Traveler' },
        status
      );
    } catch (e: any) {
      console.warn('Failed to broadcast status:', e.message);
    }
  };

  const renderShortcutIcon = (st: QuickStatusType) => {
    const color = st === 'NEED_HELP' ? '#dc2626' : '#475569';
    switch (st) {
      case 'FUEL_STOP':
        return <GasPumpIcon size={13} color={color} />;
      case 'FOOD_STOP':
        return <RestaurantIcon size={13} color={color} />;
      case 'BREAK':
        return <CoffeeIcon size={13} color={color} />;
      case 'TRAFFIC':
        return <TrafficIcon size={13} color={color} />;
      case 'NEED_HELP':
        return <AlertTriangleIcon size={13} color={color} />;
      default:
        return null;
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderUid === profile?.uid;
    const isStatus = item.type === 'STATUS' || item.type === 'EMERGENCY';

    if (isStatus) {
      return (
        <View style={styles.statusBubble}>
          <Text style={styles.statusBubbleText}>
            {item.senderName}: {item.text}
          </Text>
          <Text style={styles.statusTime}>{formatRecency(item.timestamp)}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
            {item.text}
          </Text>
          <Text style={[styles.messageTime, isMe ? styles.myMessageTime : styles.otherMessageTime]}>
            {pendingIds.has(item.id) ? 'Sending...' : formatRecency(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{journeyName} Chat</Text>
            <Text style={styles.headerSub}>Convoy coordination • Visible to members only</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
            <CloseIcon size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Message List */}
        <FlatList
          ref={flatListRef}
          data={shown}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />

        {/* Quick Status Chips Bar (Zero Emojis, Pure SVG Vector Icons) */}
        <View style={styles.shortcutsBar}>
          {CHAT_STATUS_SHORTCUTS.map((status) => {
            const meta = QUICK_STATUS_LABELS[status];
            const isHelp = status === 'NEED_HELP';

            return (
              <TouchableOpacity
                key={status}
                style={[styles.shortcutChip, isHelp && styles.helpChip]}
                onPress={() => handleQuickStatus(status)}
                activeOpacity={0.8}
              >
                {renderShortcutIcon(status)}
                <Text style={[styles.shortcutText, isHelp && styles.helpText]}>
                  {meta.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message to the convoy..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <SendIcon size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#0f172a',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  otherMessageTime: {
    color: '#94a3b8',
  },
  statusBubble: {
    alignSelf: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
  },
  statusBubbleText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  statusTime: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  shortcutsBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
    overflow: 'hidden',
  },
  shortcutChip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  shortcutText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  helpChip: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  helpText: {
    color: '#dc2626',
  },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sendButton: {
    backgroundColor: '#2563eb',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.5,
  },
});
