"use client";

import { cn } from "@/src/lib/utils";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy } from "lucide-react";

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
  const t = useTranslations("AI");

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  return (
    <div className="flex-1 flex justify-center p-8 overflow-y-auto min-h-0 mb-10">
      <div className="w-full max-w-[50%]">
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
                "relative group max-w-[80%]",
                message.role === "user" ? "flex flex-col items-end" : "",
              )}
            >
              <div
                className={cn(
                  "p-4 break-words",
                  message.role === "user"
                    ? "bg-gray-100 text-gray-900 rounded-3xl"
                    : "bg-white text-gray-900 pb-1 rounded-lg",
                )}
              >
                <p className="whitespace-pre-wrap text-base break-all">
                  {message.content}
                </p>
              </div>

              {message.role === "user" && (
                <div className="mt-1 flex justify-end gap-2 items-center w-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-xs text-gray-500">
                    {message.timestamp.toLocaleString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <button
                    className="p-1 text-gray-400 hover:text-gray-600"
                    onClick={() => {
                      navigator.clipboard.writeText(message.content);
                      toast.success(t("copied"));
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              )}

              {message.role === "assistant" && (
                <div className="flex justify-start gap-2 items-center w-full opacity-0 group-hover:opacity-100 transition-opacity pl-4">
                  <div className="text-xs text-gray-500">
                    {message.timestamp.toLocaleString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <button
                    className="p-1 text-gray-400 hover:text-gray-600"
                    onClick={() => {
                      navigator.clipboard.writeText(message.content);
                      toast.success(t("copied"));
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="mb-8">
            <div className="rounded-lg p-4 bg-white text-gray-900">
              <p className="text-base">{t("thinking")}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
