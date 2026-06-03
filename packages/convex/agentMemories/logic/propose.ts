import { mutation } from "@convex/server";
import { v } from "convex/values";
import {
  memoryCategoryValidator,
  memoryKindValidator,
  memoryPrivacyValidator,
  memoryScopeLevelValidator,
  memorySourceValidator,
  memoryStabilityValidator,
  memoryTypeValidator,
} from "../model";
import { buildMemoryPatch, contentOverlapScore } from "./shared";

export const proposeAgentMemory = mutation({
  args: {
    type: memoryTypeValidator,
    content: v.string(),
    source: memorySourceValidator,
    reason: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    kind: v.optional(memoryKindValidator),
    category: v.optional(memoryCategoryValidator),
    scopeLevel: v.optional(memoryScopeLevelValidator),
    scopeKey: v.optional(v.string()),
    evidenceConversationId: v.optional(v.id("aiConversations")),
    evidenceMessageId: v.optional(v.id("aiMessages")),
    evidenceDocumentId: v.optional(v.id("documents")),
    evidenceToolCallId: v.optional(v.string()),
    evidenceText: v.optional(v.string()),
    evidenceUrl: v.optional(v.string()),
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

    const now = Date.now();
    const memoryPatch = buildMemoryPatch(args, identity.subject);
    const candidates = await ctx.db
      .query("agentMemories")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", identity.subject).eq("status", "active"),
      )
      .take(100);
    const relatedMemoryIds = candidates
      .filter((candidate) =>
        (candidate.kind ?? "") === memoryPatch.kind
        && (candidate.category ?? "") === memoryPatch.category
        && (candidate.scopeLevel ?? "user") === memoryPatch.scopeLevel
        && (candidate.scopeKey ?? identity.subject) === memoryPatch.scopeKey,
      )
      .filter((candidate) => contentOverlapScore(candidate.content, memoryPatch.content) >= 0.5)
      .slice(0, 5)
      .map((candidate) => candidate._id);
    const memoryId = await ctx.db.insert("agentMemories", {
      userId: identity.subject,
      ...memoryPatch,
      source: args.source,
      status: "pending_review",
      conflictsWith: relatedMemoryIds.length > 0 ? relatedMemoryIds : undefined,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: memoryId,
      ...memoryPatch,
      source: args.source,
      status: "pending_review",
      possibleDuplicateIds: relatedMemoryIds,
      possibleConflictIds: relatedMemoryIds,
      createdAt: now,
      updatedAt: now,
    };
  },
});
