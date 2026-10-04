import { ref, set, onValue, off, DataSnapshot } from 'firebase/database';
import { getFirebaseDb } from './firebaseApp';
import { ChatMessage, MessageType } from '@/types/chat';
import { getLocalStore } from '@/db/sqliteClient';
import { Paths } from '@/data/paths';
import { stripUndefined } from '@/data/serialization';
import { isOnline } from '../connectivity';

export interface SendResult {
  message: ChatMessage;
  /** True when offline: saved on the phone and sent automatically once the connection returns. */
  queued: boolean;
}

async function writeMessage(journeyId: string, message: ChatMessage): Promise<void> {
  await set(ref(getFirebaseDb(), Paths.chatMessage(journeyId, message.id)), stripUndefined(message));
}

export async function sendChatMessage(
  journeyId: string,
  sender: { uid: string; name: string },
  text: string,
  type: MessageType = 'TEXT'
): Promise<SendResult> {
  const message: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    senderUid: sender.uid,
    senderName: sender.name,
    text: text.trim(),
    timestamp: Date.now(),
    type,
  };

  if (!isOnline()) {
    await (await getLocalStore()).enqueueChat(journeyId, message);
    return { message, queued: true };
  }
  await writeMessage(journeyId, message);
  return { message, queued: false };
}

/** Sends everything typed while offline. Safe to call any time; stops quietly if still offline. */
export async function flushChatOutbox(journeyId: string): Promise<void> {
  if (!isOnline()) return;
  const store = await getLocalStore();
  for (const message of await store.getChatOutbox(journeyId)) {
    try {
      await writeMessage(journeyId, message);
    } catch (error) {
      // Rejected by the rules (journey ended / removed): this message can never be delivered.
      if (/permission/i.test(String((error as Error)?.message))) {
        await store.removeChat(message.id);
        continue;
      }
      return; // transient: try again on the next reconnect
    }
    await store.removeChat(message.id);
  }
}

export async function getPendingChat(journeyId: string): Promise<ChatMessage[]> {
  try {
    return await (await getLocalStore()).getChatOutbox(journeyId);
  } catch {
    return [];
  }
}

/** Realtime listener for the journey's group chat. */
export function subscribeToChatMessages(
  journeyId: string,
  onMessagesUpdate: (messages: ChatMessage[]) => void
): () => void {
  const chatPathRef = ref(getFirebaseDb(), Paths.chat(journeyId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.exists() ? (snapshot.val() as Record<string, ChatMessage>) : {};
    onMessagesUpdate(Object.values(data).sort((a, b) => a.timestamp - b.timestamp));
  };

  onValue(chatPathRef, callback, () => onMessagesUpdate([]));
  return () => off(chatPathRef, 'value', callback);
}
