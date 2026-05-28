import { useMemoizedFn } from "ahooks";
import { useUser } from "@clerk/nextjs";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ChatMessage, Conversation, ToolCallResult } from "./types";

/**
 * AI Chat 数据持久化 Hook
 * 封装 Convex 读写操作：会话列表加载/创建/删除、消息保存/加载、标题更新
 */
export function useAIChatPersistence() {
  const { user } = useUser();
  const convex = useConvex();
  const t = useTranslations("AI");

  const loadConversations = useMemoizedFn(async (): Promise<Conversation[]> => {
    if (!user) return [];
    try {
      const result = await convex.query(api.aiChat.getConversations, {});
      return result as Conversation[];
    } catch (error) {
      console.error("Error loading conversations:", error);
      return [];
    }
  });

  const loadMessages = useMemoizedFn(async (convId: Id<"aiConversations">): Promise<ChatMessage[]> => {
    if (!user) return [];
    const msgs = await convex.query(api.aiChat.getMessages, { conversationId: convId });
    return msgs.map((msg: any) => {
      let content = msg.content;
      let reasoningContent: string | undefined;
      let toolResults: ToolCallResult[] | undefined;
      try {
        const parsedContent = JSON.parse(msg.content);
        if (parsedContent.content !== undefined) {
          content = parsedContent.content;
          reasoningContent = parsedContent.reasoningContent;
          if (parsedContent.toolResults) {
            try {
              toolResults = typeof parsedContent.toolResults === "string"
                ? JSON.parse(parsedContent.toolResults)
                : parsedContent.toolResults;
            } catch {}
          }
        }
      } catch {}
      return {
        id: msg._id,
        content,
        reasoningContent,
        role: msg.role,
        timestamp: new Date(msg.createdAt),
        toolResults,
      };
    });
  });

  const createConversation = useMemoizedFn(async (title: string): Promise<Id<"aiConversations"> | null> => {
    if (!user) return null;
    try {
      return await convex.mutation(api.aiChat.createConversation, { title });
    } catch (error) {
      console.error("Error creating conversation:", error);
      return null;
    }
  });

  const saveMessage = useMemoizedFn(async (
    conversationId: Id<"aiConversations">,
    content: string,
    role: "user" | "assistant",
  ): Promise<Id<"aiMessages"> | null> => {
    try {
      return await convex.mutation(api.aiChat.addMessage, { conversationId, content, role });
    } catch (err) {
      console.error("[Chat] Failed to save message to Convex:", err);
      return null;
    }
  });

  const updateConversationTitle = useMemoizedFn(async (
    conversationId: Id<"aiConversations">,
    title: string,
  ) => {
    try {
      await convex.mutation(api.aiChat.updateConversationTitle, { conversationId, title });
    } catch (err) {
      console.error("[Chat] Failed to update conversation title:", err);
    }
  });

  const deleteConversation = useMemoizedFn(async (
    convId: Id<"aiConversations">,
    isCurrentConversation: boolean,
  ) => {
    if (!user) return;
    if (isCurrentConversation) {
      toast.error(t("cannotDeleteCurrentConversation"));
      return;
    }
    try {
      await convex.mutation(api.aiChat.deleteConversation, { conversationId: convId });
      toast.success(t("conversationDeleted"));
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error(t("deleteFailed"));
    }
  });

  return {
    loadConversations,
    loadMessages,
    createConversation,
    saveMessage,
    updateConversationTitle,
    deleteConversation,
  };
}
