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
}

export const MessageList = ({
  messages,
  isLoading,
  messagesEndRef,
}: MessageListProps) => {
  const t = useTranslations("RAG");

  return (
    <div className="flex-1 p-8 overflow-y-auto min-h-0">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "mb-8 max-w-3xl",
            message.role === "user" ? "ml-auto" : "",
          )}
        >
          <div
            className={cn(
              "rounded-lg p-4",
              message.role === "user"
                ? "bg-gray-100 text-gray-900"
                : "bg-white text-gray-900 border border-gray-200",
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="mb-8 max-w-3xl">
          <div className="rounded-lg p-4 bg-white text-gray-900 border border-gray-200">
            <p>{t("thinking")}</p>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
