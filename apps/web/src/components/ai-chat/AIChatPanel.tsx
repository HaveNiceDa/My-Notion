"use client";

import React, { useRef, useEffect, useMemo, useState } from "react";
import { useMemoizedFn } from "ahooks";
import { formatRelativeTime } from "@notion/business/utils";
import { useTranslations } from "next-intl";
import {
  X,
  Plus,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@notion/business/utils";
import { Id } from "@/convex/_generated/dataModel";
import { useAIChatStore } from "@/src/lib/store/use-ai-chat-store";
import { useResizableWidth } from "@/src/hooks/useResizableWidth";
import { useAIChat } from "./useAIChat";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import type { Conversation } from "./types";

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId: Id<"aiConversations"> | null;
  isLoading: boolean;
  onSelect: (id: Id<"aiConversations">) => void;
  onDelete: (id: Id<"aiConversations">) => void;
  formatTime: (ts: number) => string;
}

const ConversationList = React.memo(
  ({
    conversations,
    currentConversationId,
    isLoading,
    onSelect,
    onDelete,
    formatTime,
  }: ConversationListProps) => {
    const t = useTranslations("AI");

    if (isLoading) {
      return (
        <div className="p-3 text-center text-muted-foreground text-xs">
          {t("loading")}
        </div>
      );
    }

    if (conversations.length === 0) {
      return (
        <div className="p-3 text-center text-muted-foreground text-xs">
          {t("noConversationRecords")}
        </div>
      );
    }

    return (
      <div className="max-h-48 overflow-y-auto">
        {conversations.map((conv) => (
          <div
            key={conv._id}
            className={cn(
              "flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors",
              currentConversationId === conv._id
                ? "bg-accent"
                : "hover:bg-muted",
            )}
            onClick={() => onSelect(conv._id)}
          >
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{conv.title}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {formatTime(conv.updatedAt)}
                </span>
              </div>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv._id);
              }}
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500 shrink-0"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          </div>
        ))}
      </div>
    );
  },
);

ConversationList.displayName = "ConversationList";

export function AIChatPanel() {
  const { panelOpen, closePanel } = useAIChatStore();
  const { width, handleMouseDown } = useResizableWidth({
    initialWidth: 400,
    minWidth: 320,
    maxWidth: 520,
    localStorageKey: "ai-chat-panel-width",
    direction: "left",
  });
  const tc = useTranslations("Common");
  const t = useTranslations("AI");

  const {
    messages,
    input,
    setInput,
    isLoading,
    conversationId,
    conversationCreatedAt,
    conversations,
    isLoadingConversations,
    modelId,
    setModelId,
    mode,
    setMode,
    enableThinking,
    toggleThinking,
    sendMessage,
    createNewConversation,
    loadConversation,
    deleteConversation,
  } = useAIChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showConvList, setShowConvList] = useState(false);

  const scrollToBottom = useMemoizedFn(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  });

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  const handleInputChange = useMemoizedFn((value: string) => {
    setInput(value);
  });

  const formatTime = useMemoizedFn((ts: number) => formatRelativeTime(ts, tc));

  if (!panelOpen) return null;

  return (
    <div
      className="h-full border-l border-border bg-muted/40 flex flex-col shrink-0 relative shadow-[-8px_0_24px_rgba(15,23,42,0.06)] dark:shadow-[-8px_0_24px_rgba(0,0,0,0.25)]"
      style={{ width: `${width}px` }}
    >
      {/* 拖拽调整宽度的手柄 */}
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-ew-resize hover:bg-primary/30 active:bg-primary/50 z-10 transition-colors"
        onMouseDown={handleMouseDown}
      />

      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-medium"
            onClick={() => setShowConvList(!showConvList)}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            {t("conversationHistory")}
            {showConvList ? (
              <ChevronUp className="h-3 w-3 ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-1" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={createNewConversation}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={closePanel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 会话列表（可折叠） */}
      {showConvList && (
        <div className="border-b border-border px-2 py-1 shrink-0">
          <ConversationList
            conversations={conversations}
            currentConversationId={conversationId}
            isLoading={isLoadingConversations}
            onSelect={loadConversation}
            onDelete={deleteConversation}
            formatTime={formatTime}
          />
        </div>
      )}

      {/* 消息列表 */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
        conversationCreatedAt={conversationCreatedAt}
      />

      {/* 输入区域 */}
      <div className="px-3 pb-3 pt-1 shrink-0">
        <MessageInput
          input={input}
          onInputChange={handleInputChange}
          onSend={sendMessage}
          modelId={modelId}
          onModelChange={setModelId}
          mode={mode}
          onModeChange={setMode}
          enableThinking={enableThinking}
          onToggleThinking={toggleThinking}
          isSending={isLoading}
        />
      </div>
    </div>
  );
}
