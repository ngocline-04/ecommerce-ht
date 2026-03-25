export type SenderRole = "customer" | "staff" | "bot";
export type MessageType = "text" | "image" | "product";

export type ChatProduct = {
  id: string;
  name: string;
  price?: number | null;
  image?: string | null;
  slug?: string | null;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderRole: SenderRole;
  type: MessageType;
  text: string | null;
  imageUrl: string | null;
  product: ChatProduct | null;
  createdAt?: any;
  seenBy: string[];
  metadata?: Record<string, any>;
};

export type ConversationRecord = {
  id: string;
  customerKey: string;
  customerUserId: string | null;
  guestSessionId: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  assignedStaffId?: string | null;
  botEnabled: boolean;
  botPending?: boolean;
  pendingMessageId?: string | null;
  isClosed?: boolean;
  lastMessage?: string | null;
  lastMessageType?: MessageType | null;
  lastSenderId?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

export type UserRecord = {
  id: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  isStaff?: boolean;
};