/**
 * 文档相关操作方法
 */
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

// AI对话相关操作

/**
 * 获取用户的所有AI对话
 */
export const getConversations = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiConversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

/**
 * 获取对话的所有消息
 */
export const getMessages = query({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .collect();
  },
});

/**
 * 创建新对话
 */
export const createConversation = mutation({
  args: { userId: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("aiConversations", {
      userId: args.userId,
      title: args.title,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * 添加消息到对话
 */
export const addMessage = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const messageId = await ctx.db.insert("aiMessages", {
      conversationId: args.conversationId,
      content: args.content,
      role: args.role,
      createdAt: now,
      documentId: args.documentId,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
    });

    return messageId;
  },
});

/**
 * 更新对话标题
 */
export const updateConversationTitle = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/**
 * 删除对话
 */
export const deleteConversation = mutation({
  args: { conversationId: v.id("aiConversations"), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = args.userId;

    // 获取对话信息
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // 验证用户权限
    if (conversation.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // 删除对话的所有消息
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // 删除对话本身
    await ctx.db.delete(args.conversationId);
    return true;
  },
});

/**
 * 获取用户文档（用于RAG处理）
 */
export const getDocumentsForRAG = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

/**
 * 获取用户知识库文档（用于RAG处理）
 */
export const getKnowledgeBaseDocumentsForRAG = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("isInKnowledgeBase"), true)
        )
      )
      .collect();
  },
});

/**
 * 添加思考过程步骤
 */
export const addThinkingStep = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    messageId: v.optional(v.id("aiMessages")),
    type: v.string(),
    content: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("aiThinkingSteps", {
      conversationId: args.conversationId,
      messageId: args.messageId,
      type: args.type,
      content: args.content,
      details: args.details,
      createdAt: now,
    });
  },
});

/**
 * 获取对话的思考过程步骤
 */
export const getThinkingSteps = query({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiThinkingSteps")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

/**
 * 删除对话的所有思考过程步骤
 */
export const deleteThinkingSteps = mutation({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    // 获取对话的所有思考过程步骤
    const steps = await ctx.db
      .query("aiThinkingSteps")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    // 删除所有步骤
    for (const step of steps) {
      await ctx.db.delete(step._id);
    }

    return steps.length;
  },
});
