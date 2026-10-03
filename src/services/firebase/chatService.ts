import { ref, set, onValue, off, DataSnapshot } from 'firebase/database';
import { getFirebaseDb } from './firebaseApp';
import { ChatMessage, MessageType } from '@/types/chat';
import { syncService } from '@/services/offlineMaps/reconnectSyncService';

/**
 * Handles journey group chat messaging.
 * Matches Section 14.1 of Developer Handoff.
 */
export async function sendChatMessage(
  journeyId: string,
  sender: { uid: string; name: string },
  text: string,
  type: MessageType = 'TEXT'
): Promise<ChatMessage> {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const message: ChatMessage = {
    id: messageId,
    senderUid: sender.uid,
    senderName: sender.name,
    text: text.trim(),
    timestamp: Date.now(),
    type,
  };

  // If offline, queue locally via syncService
  const isOnline = await syncService.handleChatMessage(journeyId, message);
  if (isOnline) {
    const db = getFirebaseDb();
    const chatRef = ref(db, `journeys/${journeyId}/chat/${messageId}`);
    await set(chatRef, message);
  }

  return message;
}

/**
 * Realtime listener for group chat messages in an active journey.
 */
export function subscribeToChatMessages(
  journeyId: string,
  onMessagesUpdate: (messages: ChatMessage[]) => void
): () => void {
  const db = getFirebaseDb();
  const chatPathRef = ref(db, `journeys/${journeyId}/chat`);

  const callback = (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val() as Record<string, ChatMessage>;
      const messageList = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
      onMessagesUpdate(messageList);
    } else {
      onMessagesUpdate([]);
    }
  };

  onValue(chatPathRef, callback);

  return () => {
    off(chatPathRef, 'value', callback);
  };
}
