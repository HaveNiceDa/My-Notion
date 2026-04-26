"use client";

import { useRef, useEffect } from "react";
import { useMemoizedFn } from "ahooks";
import { formatRelativeTime } from "@notion/business/utils";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useKnowledgeBaseStore } from "@/src/lib/store/use-knowledge-base-store";
import dynamic from "next/dynamic";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { TopNavigation } from "./components/TopNavigation";
import { NewConversationLanding } from "./components/NewConversationLanding";
import { MessageInput } from "./components/MessageInput";
import { useAIChat } from "./hooks/useAIChat";

const MessageList = dynamic(
  () =>
    import("./components/MessageList").then((module) => ({
      default: module.MessageList,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 w-full flex items-center justify-center p-8">
        <div className="w-8 h-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    ),
  },
);

if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    import("./components/MessageList").catch(() => {});
  });
  window.addEventListener(
    "keydown",
    () => {
      import("./components/MessageList").catch(() => {});
    },
    { once: true },
  );
}

const AIPage = () => {
  const searchParams = useSearchParams();
  const tc = useTranslations("common");
  const { enabled: knowledgeBaseEnabled } = useKnowledgeBaseStore();

  const {
    messages,
    input,
    setInput,
    isLoading,
    conversationId,
    conversationCreatedAt,
    conversations,
    isLoadingConversations,
    showConversationList,
    setShowConversationList,
    isConversationListPinned,
    setIsConversationListPinned,
    sendMessage,
    handleGetImages,
    createNewConversation,
    loadConversation,
    deleteConversation,
  } = useAIChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useMemoizedFn(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  const handleInputChange = useMemoizedFn((value: string) => {
    setInput(value);
  });

  return (
    <div className="h-screen w-full">
      <div className="h-full w-full bg-background overflow-hidden relative">
        <ConversationSidebar
          show={showConversationList || isConversationListPinned}
          isPinned={isConversationListPinned}
          conversations={conversations}
          isLoading={isLoadingConversations}
          onClose={() =>
            !isConversationListPinned && setShowConversationList(false)
          }
          onPin={() => setIsConversationListPinned(!isConversationListPinned)}
          onNewConversation={createNewConversation}
          onSelectConversation={loadConversation}
          onDeleteConversation={deleteConversation}
          currentConversationId={conversationId}
          formatRelativeTime={(ts) => formatRelativeTime(ts, tc)}
        />

        <div
          className="h-full w-full flex flex-col"
          onClick={() =>
            !isConversationListPinned &&
            showConversationList &&
            setShowConversationList(false)
          }
        >
          {!searchParams.get("id") ? (
            <div className="flex-1 flex flex-col bg-background">
              <TopNavigation
                onShowHistory={() => setShowConversationList(true)}
              />
              <NewConversationLanding
                input={input}
                onInputChange={handleInputChange}
                onSend={sendMessage}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full pb-4">
              <TopNavigation
                onShowHistory={() => setShowConversationList(true)}
              />
              <MessageList
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                conversationCreatedAt={conversationCreatedAt}
                conversationId={conversationId}
                knowledgeBaseEnabled={knowledgeBaseEnabled}
              />
              <div className="w-full flex justify-center">
                <div className="w-[55%]">
                  <MessageInput
                    input={input}
                    onInputChange={handleInputChange}
                    onSend={sendMessage}
                    onGetImages={handleGetImages}
                    conversationId={conversationId}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIPage;
