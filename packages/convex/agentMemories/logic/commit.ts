import { mutation } from "@convex/server";
import { v } from "convex/values";
import {
  memoryCategoryValidator,
  memoryKindValidator,
  memoryPrivacyValidator,
  memoryScopeLevelValidator,
  memoryStabilityValidator,
  memoryTypeValidator,
} from "../model";
import { buildMemoryPatch } from "./shared";

export const commitAgentMemory = mutation({
  args: {
    memoryId: v.id("agentMemories"),
    type: v.optional(memoryTypeValidator),
    content: v.optional(v.string()),
    reason: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    kind: v.optional(memoryKindValidator),
    category: v.optional(memoryCategoryValidator),
    scopeLevel: v.optional(memoryScopeLevelValidator),
    scopeKey: v.optional(v.string()),
    confidence: v.optional(v.number()),
    importance: v.optional(v.number()),
    stability: v.optional(memoryStabilityValidator),
    privacy: v.optional(memoryPrivacyValidator),
    expiresAt: v.optional(v.number()),
    reviewDueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.userId !== identity.subject || memory.status !== "pending_review") {
      throw new Error("Memory proposal not found");
    }

    const now = Date.now();
    const memoryPatch = buildMemoryPatch({
      type: args.type ?? memory.type,
      content: args.content ?? memory.content,
      reason: args.reason ?? memory.reason,
      summary: args.summary ?? memory.summary,
      tags: args.tags ?? memory.tags,
      kind: args.kind ?? memory.kind,
      category: args.category ?? memory.category,
      scopeLevel: args.scopeLevel ?? memory.scopeLevel,
      scopeKey: args.scopeKey ?? memory.scopeKey,
      evidenceConversationId: memory.evidenceConversationId,
      evidenceMessageId: memory.evidenceMessageId,
      evidenceDocumentId: memory.evidenceDocumentId,
      evidenceToolCallId: memory.evidenceToolCallId,
      evidenceText: memory.evidenceText,
      evidenceUrl: memory.evidenceUrl,
      confidence: args.confidence ?? memory.confidence,
      importance: args.importance ?? memory.importance,
      stability: args.stability ?? memory.stability,
      privacy: args.privacy ?? memory.privacy,
      expiresAt: args.expiresAt ?? memory.expiresAt,
      reviewDueAt: args.reviewDueAt ?? memory.reviewDueAt,
      embeddingStatus: "pending",
    }, identity.subject);

    await ctx.db.patch(args.memoryId, {
      ...memoryPatch,
      status: "active",
      updatedAt: now,
    });

    return {
      id: args.memoryId,
      ...memoryPatch,
      source: memory.source,
      status: "active",
      createdAt: memory.createdAt,
      updatedAt: now,
    };
  },
});
