"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { runRAGQueryStream } from "@/src/lib/rag";
import { formatRelativeTime } from "@/src/lib/timeUtils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { TopNavigation } from "./components/TopNavigation";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { NewConversationLanding } from "./components/NewConversationLanding";
import { MessageList } from "./components/MessageList";
import { MessageInput } from "./components/MessageInput";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface Message {
  id: string;
  content: string;
  role: string;
  timestamp: Date;
}

const RAGPage = () => {
  const { user } = useUser();
  const t = useTranslations("RAG");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] =
    useState<Id<"ragConversations"> | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const initConversation = async () => {
      if (!user) return;

      try {
        const loadedConversations = await convex.query(
          api.documents.getConversations,
          {
            userId: user.id,
          },
        );
        setConversations(loadedConversations);

        const urlParams = new URLSearchParams(window.location.search);
        const conversationIdFromUrl = urlParams.get("id");

        if (conversationIdFromUrl) {
          await loadConversation(
            conversationIdFromUrl as Id<"ragConversations">,
          );
        }
      } catch (error) {
        console.error("Error initializing conversation:", error);
      }
    };

    initConversation();
  }, [user]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user) return;

    let currentConversationId = conversationId;

    if (!currentConversationId) {
      try {
        currentConversationId = await convex.mutation(
          api.documents.createConversation,
          {
            userId: user.id,
            title: t("newConversation"),
          },
        );
        setConversationId(currentConversationId);

        const url = new URL(window.location.href);
        url.searchParams.set("id", currentConversationId);
        window.history.pushState({}, "", url.toString());
      } catch (error) {
        console.error("Error creating conversation:", error);
        toast.error("创建对话失败，请重试");
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const tempAssistantMessage: Message = {
      id: assistantMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, tempAssistantMessage]);

    try {
      await convex.mutation(api.documents.addMessage, {
        conversationId: currentConversationId,
        content: input,
        role: "user" as "user" | "assistant",
      });

      const conversationHistoryMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      let currentContent = "";
      await runRAGQueryStream(
        user.id,
        input,
        conversationHistoryMessages,
        (chunk) => {
          currentContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: currentContent }
                : msg,
            ),
          );
        },
        async () => {
          await convex.mutation(api.documents.addMessage, {
            conversationId: currentConversationId,
            content: currentContent,
            role: "assistant" as "user" | "assistant",
          });

          await convex.mutation(api.documents.updateConversationTitle, {
            conversationId: currentConversationId,
            title: input.length > 50 ? input.substring(0, 50) + "..." : input,
          });

          await loadConversations();
        },
        (error) => {
          console.error("Error in RAG stream:", error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: "Sorry, something went wrong. Please try again.",
                  }
                : msg,
            ),
          );
        },
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const loadConversations = async () => {
    if (!user) return;

    try {
      setIsLoadingConversations(true);
      const result = await convex.query(api.documents.getConversations, {
        userId: user.id,
      });
      setConversations(result);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const createNewConversation = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.pushState({}, "", url.toString());

    setConversationId(null);
    setMessages([]);
  };

  const loadConversation = async (convId: Id<"ragConversations">) => {
    if (!user) return;

    try {
      setIsLoading(true);
      setConversationId(convId);

      const url = new URL(window.location.href);
      url.searchParams.set("id", convId);
      window.history.pushState({}, "", url.toString());

      const messages = await convex.query(api.documents.getMessages, {
        conversationId: convId,
      });

      const formattedMessages: Message[] = messages.map((msg: any) => ({
        id: msg._id,
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.createdAt),
      }));

      setMessages(formattedMessages);
      setShowConversationList(false);
    } catch (error) {
      console.error("Error loading conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async (convId: Id<"ragConversations">) => {
    if (!user) return;

    if (conversationId === convId) {
      toast.error(t("cannotDeleteCurrentConversation"));
      return;
    }

    try {
      await convex.mutation(api.documents.deleteConversation, {
        conversationId: convId,
      });

      await loadConversations();

      toast.success(t("conversationDeleted"));
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error(t("deleteFailed"));
      await loadConversations();
    }
  };

  return (
    <div className="h-screen w-full">
      <div className="h-full w-full bg-white overflow-hidden relative">
        <ConversationSidebar
          show={showConversationList}
          conversations={conversations}
          isLoading={isLoadingConversations}
          onClose={() => setShowConversationList(false)}
          onNewConversation={createNewConversation}
          onSelectConversation={loadConversation}
          onDeleteConversation={deleteConversation}
          currentConversationId={conversationId}
          formatRelativeTime={formatRelativeTime}
        />

        <div
          className="h-full w-full flex flex-col"
          onClick={() => showConversationList && setShowConversationList(false)}
        >
          {messages.length === 0 && !isLoading ? (
            <div
              className="flex-1 flex flex-col bg-white px-8"
              onClick={(e) => e.stopPropagation()}
            >
              <TopNavigation
                onShowHistory={() => setShowConversationList(true)}
              />
              <NewConversationLanding
                input={input}
                onInputChange={setInput}
                onSend={handleSend}
                onKeyPress={handleKeyPress}
              />
            </div>
          ) : (
            <div
              className="flex-1 flex flex-col h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <TopNavigation
                onShowHistory={() => setShowConversationList(true)}
              />
              <MessageList
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
              />
              <MessageInput
                input={input}
                onInputChange={setInput}
                onSend={handleSend}
                onKeyPress={handleKeyPress}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RAGPage;
