"use client";

import { cn } from "@/src/lib/utils";
import { useTranslations } from "next-intl";

interface Message {
  id: string;
  content: string;
  role: string;
  timestamp: Date;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  conversationCreatedAt: Date | null;
}

export const MessageList = ({
  messages,
  isLoading,
  messagesEndRef,
  conversationCreatedAt,
}: MessageListProps) => {
  const t = useTranslations("RAG");

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  return (
    <div className="flex-1 flex justify-center p-8 overflow-y-auto min-h-0">
      <div className="w-full max-w-[60%]">
        {conversationCreatedAt && (
          <div className="mb-8 text-center">
            <div className="inline-block text-gray-600 px-4 py-1 rounded-full text-sm">
              {formatDate(conversationCreatedAt)} · Notion AI
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "mb-8",
              message.role === "user" ? "flex justify-end" : "",
            )}
          >
            <div
              className={cn(
                "rounded-lg p-4 max-w-[80%]",
                message.role === "user"
                  ? "bg-gray-100 text-gray-900"
                  : "bg-white text-gray-900",
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="mb-8">
            <div className="rounded-lg p-4 bg-white text-gray-900">
              <p>{t("thinking")}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
