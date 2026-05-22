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
  History,
  Pin,
  PinOff,
  FileText,
  Languages,
  Search,
  CircleCheck,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
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

interface EmptyHomeProps {
  onPromptSelect: (prompt: string) => void;
}

const EmptyHome = React.memo(({ onPromptSelect }: EmptyHomeProps) => {
  const t = useTranslations("AI");

  const actions = useMemo(
    () => [
      {
        icon: FileText,
        label: t("summarizeThisPage"),
        prompt: t("summarizeThisPagePrompt"),
      },
      {
        icon: Languages,
        label: t("translateThisPage"),
        prompt: t("translateThisPagePrompt"),
      },
      {
        icon: Search,
        label: t("deepAnalyze"),
        prompt: t("deepAnalyzePrompt"),
      },
      {
        icon: CircleCheck,
        label: t("createTaskTracker"),
        prompt: t("createTaskTrackerPrompt"),
      },
    ],
    [t],
  );

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6">
      <div className="min-h-full flex flex-col justify-end gap-5 pb-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {t("todayIWillHelp")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("aiSidebarHomeSubtitle")}
          </p>
        </div>

        <div className="space-y-1.5">
          {actions.map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              type="button"
              onClick={() => onPromptSelect(prompt)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{label}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
});

EmptyHome.displayName = "EmptyHome";

export function AIChatPanel() {
  const { panelOpen, panelPinned, closePanel, togglePinned } = useAIChatStore();
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
    enableThinking,
    toggleThinking,
    toolCalls,
    sendMessage,
    createNewConversation,
    loadConversation,
    deleteConversation,
  } = useAIChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showConvList, setShowConvList] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");

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

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(query),
    );
  }, [conversationSearch, conversations]);

  const handleLoadConversation = useMemoizedFn((id: Id<"aiConversations">) => {
    loadConversation(id);
    setShowConvList(false);
  });

  const handlePromptSelect = useMemoizedFn((prompt: string) => {
    setInput(prompt);
  });

  if (!panelOpen) return null;

  return (
    <div
      className={cn(
        "h-full border-l border-border bg-background flex flex-col shadow-[-8px_0_24px_rgba(15,23,42,0.08)] dark:shadow-[-8px_0_24px_rgba(0,0,0,0.28)]",
        panelPinned
          ? "shrink-0 relative z-10"
          : "absolute right-0 top-0 bottom-0 z-50",
      )}
      style={{ width: `${width}px` }}
    >
      {/* 拖拽调整宽度的手柄 */}
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-ew-resize hover:bg-primary/30 active:bg-primary/50 z-10 transition-colors"
        onMouseDown={handleMouseDown}
      />

      {/* 顶部常驻操作区：历史、新建、固定和关闭在首页/对话态都保持可用。 */}
      <div className="relative z-20 flex items-center justify-between px-3 py-2 border-b border-border bg-background/95 backdrop-blur shrink-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 min-w-0 px-2 text-sm font-medium"
            onClick={() => setShowConvList(!showConvList)}
          >
            <History className="mr-1.5 h-4 w-4 shrink-0" />
            <span className="truncate">{t("conversationHistory")}</span>
            <ChevronDown
              className={cn(
                "ml-1 h-3.5 w-3.5 shrink-0 transition-transform",
                showConvList && "rotate-180",
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={createNewConversation}
            title={t("newConversation")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              panelPinned && "bg-muted text-foreground",
            )}
            onClick={togglePinned}
            title={panelPinned ? t("unpinSidebar") : t("pinSidebar")}
          >
            {panelPinned ? (
              <PinOff className="h-4 w-4" />
            ) : (
              <Pin className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={closePanel}
            title={t("closeSidebar")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 历史对话从顶部浮层打开，避免挤压首页或当前对话内容。 */}
      {showConvList && (
        <div className="absolute left-3 right-3 top-12 z-30 rounded-xl border border-border bg-popover p-2 shadow-lg">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder={t("searchConversationHistory")}
              className="h-8 pl-7 text-xs"
            />
          </div>
          <ConversationList
            conversations={filteredConversations}
            currentConversationId={conversationId}
            isLoading={isLoadingConversations}
            onSelect={handleLoadConversation}
            onDelete={deleteConversation}
            formatTime={formatTime}
          />
        </div>
      )}

      {messages.length === 0 ? (
        <EmptyHome onPromptSelect={handlePromptSelect} />
      ) : (
        <MessageList
          messages={messages}
          isLoading={isLoading}
          toolCalls={toolCalls}
          messagesEndRef={messagesEndRef}
          conversationCreatedAt={conversationCreatedAt}
        />
      )}

      {/* 输入区域 */}
      <div className="px-3 pb-3 pt-1 shrink-0 bg-background">
        <MessageInput
          input={input}
          onInputChange={handleInputChange}
          onSend={sendMessage}
          modelId={modelId}
          onModelChange={setModelId}
          enableThinking={enableThinking}
          onToggleThinking={toggleThinking}
          isSending={isLoading}
        />
      </div>
    </div>
  );
}
