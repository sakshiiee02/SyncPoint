export type MessageType = 'TEXT' | 'STATUS' | 'EMERGENCY';

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  timestamp: number;
  type: MessageType;
}
