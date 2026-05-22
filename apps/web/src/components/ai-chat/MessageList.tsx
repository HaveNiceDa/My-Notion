"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@notion/business/utils";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, ChevronDown, ChevronUp, Brain, Wrench } from "lucide-react";
import type { ChatMessage, ToolCall } from "./types";

interface MessageItemProps {
  message: ChatMessage;
}

const MessageItem = React.memo(({ message }: MessageItemProps) => {
  const t = useTranslations("AI");
  const [showThinking, setShowThinking] = useState(true);

  const getMessageText = () => {
    try {
      const parsedContent = JSON.parse(message.content);
      if (parsedContent.text) return parsedContent.text;
      if (parsedContent.content) return parsedContent.content;
      return message.content;
    } catch {
      return message.content;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getMessageText());
    toast.success(t("copied"));
  };

  const renderMessageContent = () => {
    try {
      const parsedContent = JSON.parse(message.content);
      if (parsedContent.images && parsedContent.images.length > 0) {
        return (
          <div className="space-y-3">
            {parsedContent.text && (
              <p className="whitespace-pre-wrap text-sm break-all">
                {parsedContent.text}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {parsedContent.images.map((image: string, index: number) => (
                <div
                  key={index}
                  className="relative rounded-lg overflow-hidden border border-border"
                >
                  <img
                    src={image}
                    alt={`Image ${index + 1}`}
                    className="w-full h-auto max-h-32 object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      } else if (parsedContent.text) {
        return (
          <p className="whitespace-pre-wrap text-sm break-all">
            {parsedContent.text}
          </p>
        );
      } else if (parsedContent.content) {
        return (
          <p className="whitespace-pre-wrap text-sm break-all">
            {parsedContent.content}
          </p>
        );
      }
      return (
        <p className="whitespace-pre-wrap text-sm break-all">
          {message.content}
        </p>
      );
    } catch {
      return (
        <p className="whitespace-pre-wrap text-sm break-all">
          {message.content}
        </p>
      );
    }
  };

  return (
    <div className={cn("mb-4", message.role === "user" ? "flex justify-end" : "")}>
      <div
        className={cn(
          "relative group max-w-[90%]",
          message.role === "user" ? "flex flex-col items-end" : "",
        )}
      >
        {message.role === "assistant" && message.reasoningContent && (
          <div className="mb-2">
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowThinking(!showThinking)}
                className="w-full flex items-center justify-between p-2 text-xs hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Brain className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-purple-700 dark:text-purple-300">
                    {t("deepThinking")}
                  </span>
                </div>
                {showThinking ? (
                  <ChevronUp className="h-3 w-3 text-purple-500" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-purple-500" />
                )}
              </button>
              {showThinking && (
                <div className="px-2 pb-2 text-xs text-gray-700 dark:text-gray-300 border-t border-purple-200 dark:border-purple-800/50">
                  <div className="bg-white/70 dark:bg-gray-900/50 rounded p-2 max-h-40 overflow-y-auto">
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {message.reasoningContent}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className={cn(
            "p-3 break-words",
            message.role === "user"
              ? "bg-muted text-foreground rounded-2xl"
              : "bg-background text-foreground pb-1",
          )}
        >
          {renderMessageContent()}
        </div>

        <div
          className={cn(
            "flex gap-2 items-center w-full opacity-0 group-hover:opacity-100 transition-opacity mt-1",
            message.role === "user" ? "justify-end" : "justify-start pl-3",
          )}
        >
          <div className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleString("zh-CN", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <button
            className="p-0.5 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = "MessageItem";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  toolCalls?: ToolCall[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  conversationCreatedAt: Date | null;
}

export const MessageList = React.memo(
  ({
    messages,
    isLoading,
    toolCalls = [],
    messagesEndRef,
    conversationCreatedAt,
  }: MessageListProps) => {
    const t = useTranslations("AI");

    const formatDate = useMemo(() => {
      if (!conversationCreatedAt) return null;
      return conversationCreatedAt.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });
    }, [conversationCreatedAt]);

    return (
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {conversationCreatedAt && (
          <div className="mb-4 text-center">
            <div className="inline-block text-muted-foreground px-3 py-0.5 rounded-full text-xs">
              {formatDate} · Notion AI
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {toolCalls.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {toolCalls.map((toolCall) => (
              <div
                key={toolCall.id}
                className="inline-flex max-w-[90%] items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
              >
                <Wrench className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">
                  {toolCall.name === "knowledge_search"
                    ? t("knowledgeSearchTool")
                    : toolCall.name}
                </span>
                <span>
                  {toolCall.status === "completed"
                    ? t("toolCompleted")
                    : t("toolRunning")}
                </span>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="max-w-[90%]">
              <div className="p-3 break-words bg-background text-foreground pb-1">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-xs text-muted-foreground">
                    {t("generatingResponse") || "正在生成响应..."}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    );
  },
);

MessageList.displayName = "MessageList";
