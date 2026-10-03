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
} from '@/services/firebase/chatService';
import {
  broadcastQuickStatus,
  QUICK_STATUS_LABELS,
} from '@/services/firebase/statusService';
import { formatRecency } from '@/utils/timeFormat';

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
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const unsubscribe = subscribeToChatMessages(journeyId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => unsubscribe();
  }, [journeyId]);

  const handleSend = async () => {
    if (!inputText.trim() || !profile?.uid) return;
    const text = inputText;
    setInputText('');

    try {
      await sendChatMessage(
        journeyId,
        { uid: profile.uid, name: profile.name || 'Traveler' },
        text,
        'TEXT'
      );
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
      await broadcastQuickStatus(
        journeyId,
        { uid: profile.uid, name: profile.name || 'Traveler' },
        status
      );
    } catch (e: any) {
      console.warn('Failed to broadcast status:', e.message);
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
            {formatRecency(item.timestamp)}
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
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Message List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />

        {/* Quick Status Chips Bar (Section 14.1 & 14.2) */}
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
                <Text style={[styles.shortcutText, isHelp && styles.helpText]}>
                  {meta.icon} {meta.label}
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
            placeholderTextColor="#64748b"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  headerSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
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
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  myBubble: {
    backgroundColor: '#06b6d4',
    borderBottomRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#f8fafc',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#64748b',
  },
  statusBubble: {
    alignSelf: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
  },
  statusBubbleText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  statusTime: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 2,
  },
  shortcutsBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0f172a',
    gap: 6,
    overflow: 'hidden',
  },
  shortcutChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#334155',
  },
  shortcutText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  helpChip: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  helpText: {
    color: '#f87171',
  },
  inputBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendButton: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 18,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#1e293b',
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
