import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Button, Empty, Input, Spin, theme as antTheme } from "antd";
import {
  CloseOutlined,
  MessageOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { UserRecord, ChatMessage } from "./chat.type";
import { useConversationChat } from "./useConversationChat";
import ProductMessageCard from "./ProductMessageCard";

const { TextArea } = Input;

type Props = {
  currentUser: any;
  currentUserProfile: UserRecord | null;
};

const getBubbleStyle = (isMine: boolean) => {
  if (isMine) {
    return "ml-auto bg-primary-500 text-common-1000";
  }

  return "bg-color-100 text-color-900";
};

const formatTime = (createdAt?: any) => {
  const date =
    typeof createdAt?.toDate === "function"
      ? createdAt.toDate()
      : createdAt instanceof Date
        ? createdAt
        : null;

  if (!date) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
};

export default function ChatWidget({ currentUser, currentUserProfile }: Props) {
  const tokenAntd = antTheme.useToken();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const localSendingRef = useRef(false);

  const { messages, mySenderId, initializing, sending, sendMessage } =
    useConversationChat({
      isOpen: chatOpen,
      currentUserProfile,
    });

  const displayMessages = useMemo(() => {
    if (messages.length > 0) return messages;

    return [
      {
        id: "welcome-local",
        senderId: "bot_support",
        senderRole: "bot",
        type: "text",
        text: "Xin chào 👋 Bạn cần hỗ trợ gì hôm nay?",
        imageUrl: null,
        product: null,
        seenBy: [],
        metadata: {},
      } as ChatMessage,
    ];
  }, [messages]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [displayMessages, chatOpen]);

  const handleSend = async () => {
    const trimmed = chatInput.trim();

    if (!trimmed) return;
    if (sending || localSendingRef.current) return;

    localSendingRef.current = true;

    try {
      await sendMessage(trimmed);
      setChatInput("");
    } finally {
      localSendingRef.current = false;
    }
  };

  return (
    <>
      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<MessageOutlined />}
        onClick={() => setChatOpen((prev) => !prev)}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 1000,
          width: 56,
          height: 56,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}
      />

      {chatOpen ? (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 92,
            width: 380,
            height: 520,
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 16,
              background: tokenAntd.token.colorPrimary,
              color: "#fff",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Hỗ trợ trực tuyến</span>
            <Button
              type="text"
              icon={<CloseOutlined style={{ color: "#fff" }} />}
              onClick={() => setChatOpen(false)}
            />
          </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1,
              padding: 16,
              overflowY: "auto",
              background: "#fafafa",
            }}
          >
            {initializing && messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <Spin />
              </div>
            ) : displayMessages.length ? (
              <div className="flex flex-col gap-12">
                {displayMessages.map((item) => {
                  const isMine =
                    item.senderRole === "customer" && item.senderId === mySenderId;

                  const senderLabel =
                    item.senderRole === "bot"
                      ? "Chatbot"
                      : item.senderRole === "staff"
                        ? "Nhân viên"
                        : currentUser
                          ? "Bạn"
                          : "Khách";

                  return (
                    <div
                      key={item.id}
                      className={`flex max-w-[88%] flex-col gap-4 ${
                        isMine ? "ml-auto items-end" : "items-start"
                      }`}
                    >
                      {!isMine ? (
                        <div className="flex items-center gap-8 text-12 text-color-500">
                          <Avatar size="small" icon={<UserOutlined />} />
                          <span>{senderLabel}</span>
                        </div>
                      ) : null}

                      {item.type === "product" && item.product ? (
                        <div className="w-[240px]">
                          <ProductMessageCard product={item.product} />
                        </div>
                      ) : item.type === "image" && item.imageUrl ? (
                        <div
                          className={`rounded-radius-l px-8 py-8 ${getBubbleStyle(isMine)}`}
                        >
                          <img
                            src={item.imageUrl}
                            alt="chat-image"
                            style={{
                              width: 220,
                              maxWidth: "100%",
                              borderRadius: 12,
                              objectFit: "cover",
                            }}
                          />
                          {item.text ? <div className="mt-8">{item.text}</div> : null}
                        </div>
                      ) : (
                        <div
                          className={`rounded-radius-l px-12 py-8 text-14 ${getBubbleStyle(
                            isMine,
                          )}`}
                        >
                          {item.text}
                        </div>
                      )}

                      <div className="text-11 text-color-500">
                        {formatTime(item.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty description="Chưa có tin nhắn" />
            )}
          </div>

          <div
            style={{
              padding: 12,
              borderTop: `1px solid ${tokenAntd.token.colorBorderSecondary}`,
              background: "#fff",
            }}
          >
            <div className="mb-8 text-12 text-color-500">
              {currentUserProfile?.id
                ? `Đang chat với tài khoản: ${currentUserProfile.name || currentUserProfile.email || currentUserProfile.id}`
                : "Bạn đang chat với tư cách khách"}
            </div>

            <div className="flex items-end gap-8">
              <TextArea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Nhập nội dung cần hỗ trợ..."
                autoSize={{ minRows: 2, maxRows: 4 }}
                disabled={sending}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={sending}
                disabled={!chatInput.trim() || sending}
                onClick={() => void handleSend()}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}