import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ConversationRecord, UserRecord } from "@/types/chat";
import {
  claimGuestConversationToUser,
  getCurrentCustomerSenderId,
  getOrCreateConversation,
  getProductsByIds,
  searchProductsByMessage,
  sendBotProductMessage,
  sendBotTextMessage,
  sendTextMessage,
  subscribeConversation,
  subscribeConversationMessages,
} from "./chat.service";
import { useLocalFaqBot } from "./useLocalFagBot";

type UseConversationChatParams = {
  isOpen: boolean;
  currentUserProfile?: UserRecord | null;
};

const createClientMessageId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `msg_${crypto.randomUUID()}`;
  }

  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const useConversationChat = ({
  isOpen,
  currentUserProfile,
}: UseConversationChatParams) => {
  const [conversationId, setConversationId] = useState<string>("");
  const [conversation, setConversation] = useState<ConversationRecord | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [initializing, setInitializing] = useState(false);
  const [sending, setSending] = useState(false);

  const botLockRef = useRef(false);

  const mySenderId = useMemo(
    () => getCurrentCustomerSenderId(currentUserProfile),
    [currentUserProfile],
  );

  const { getBotReply, waitBotDelay } = useLocalFaqBot({
    searchProductsByIds: getProductsByIds,
    searchProductsByMessage,
  });

  const ensureConversation = useCallback(async () => {
    setInitializing(true);
    try {
      if (currentUserProfile?.id) {
        const claimedId =
          await claimGuestConversationToUser(currentUserProfile);
        if (claimedId) {
          setConversationId(claimedId);
          return claimedId;
        }
      }

      const id = await getOrCreateConversation(currentUserProfile);
      setConversationId(id);
      return id;
    } finally {
      setInitializing(false);
    }
  }, [currentUserProfile]);

  useEffect(() => {
    if (!isOpen) return;
    void ensureConversation();
  }, [isOpen, ensureConversation]);

  useEffect(() => {
    if (!conversationId) return;

    const unsubConversation = subscribeConversation(
      conversationId,
      setConversation,
    );
    const unsubMessages = subscribeConversationMessages(
      conversationId,
      setMessages,
    );

    return () => {
      unsubConversation();
      unsubMessages();
    };
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      let currentConversationId = conversationId;

      if (!currentConversationId) {
        currentConversationId = await ensureConversation();
        if (!currentConversationId) return;
      }

      const clientMessageId = createClientMessageId();

      setSending(true);
      try {
        await sendTextMessage({
          conversationId: currentConversationId,
          currentUserProfile,
          text: trimmed,
          clientMessageId,
        });
      } finally {
        setSending(false);
      }

      if (botLockRef.current) return;
      botLockRef.current = true;

      try {
        await waitBotDelay();

        const { replyText, matchedFaqKey, products } =
          await getBotReply(trimmed);

        await sendBotTextMessage({
          conversationId: currentConversationId,
          text: replyText,
          matchedFaqKey,
        });

        for (const product of products) {
          await sendBotProductMessage({
            conversationId: currentConversationId,
            product,
          });
        }
      } finally {
        botLockRef.current = false;
      }
    },
    [
      conversationId,
      currentUserProfile,
      ensureConversation,
      getBotReply,
      waitBotDelay,
    ],
  );

  return {
    conversationId,
    conversation,
    messages,
    mySenderId,
    initializing,
    sending,
    sendMessage,
  };
};
