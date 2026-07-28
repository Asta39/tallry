export type WhatsAppProviderType = "baileys" | "meta_cloud" | "ultramsg" | "twilio";

export interface GroupChat {
  groupId: string;
  name: string;
  memberCount?: number;
}

export interface MessageOptions {
  mentions?: string[]; // Phone numbers to tag in group messages (e.g. ["254712345678"])
  caption?: string;
  filename?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  /** Send an individual or group WhatsApp text message. */
  sendMessage(to: string, text: string, options?: MessageOptions): Promise<SendResult>;
  
  /** Send a document/PDF via WhatsApp. */
  sendDocument(to: string, docUrl: string, fileName: string, caption?: string): Promise<SendResult>;
  
  /** Fetch registered company group chats (where supported by provider). */
  getGroupChats?(): Promise<GroupChat[]>;
  
  /** Check connection health / QR session status. */
  getStatus?(): Promise<{ connected: boolean; qrCodeBase64?: string; phone?: string }>;
}
