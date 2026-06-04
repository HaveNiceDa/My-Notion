import { mutation } from "@convex/server";
import { v } from "convex/values";
import {
  clampScore,
  deriveMemoryDefaults,
  memoryTypeValidator,
} from "../model";
import { normalizeTags } from "./shared";

export const updateAgentMemory = mutation({
  args: {
    memoryId: v.id("agentMemories"),
    type: memoryTypeValidator,
    content: v.string(),
    reason: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    evidenceText: v.optional(v.string()),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.userId !== identity.subject || memory.status !== "active") {
      throw new Error("Memory not found");
    }

    const content = args.content.trim();
    if (!content) {
      throw new Error("content is required");
    }

    const now = Date.now();
    const defaults = deriveMemoryDefaults(args.type, identity.subject);
    const confidence = clampScore(args.confidence, 1);
    await ctx.db.patch(args.memoryId, {
      type: args.type,
      kind: defaults.kind,
      category: defaults.category,
      scopeLevel: defaults.scopeLevel,
      scopeKey: defaults.scopeKey,
      content,
      reason: args.reason?.trim() || undefined,
      ...(args.summary !== undefined ? { summary: args.summary.trim() || undefined } : {}),
      ...(args.tags !== undefined ? { tags: normalizeTags(args.tags) } : {}),
      ...(args.evidenceText !== undefined ? { evidenceText: args.evidenceText.trim() || undefined } : {}),
      confidence,
      importance: defaults.importance,
      stability: defaults.stability,
      privacy: defaults.privacy,
      embeddingStatus: "pending",
      embeddingRetryCount: memory.embeddingRetryCount ?? defaults.embeddingRetryCount,
      updatedAt: now,
    });

    return {
      id: args.memoryId,
      type: args.type,
      kind: defaults.kind,
      category: defaults.category,
      scopeLevel: defaults.scopeLevel,
      scopeKey: defaults.scopeKey,
      content,
      source: memory.source,
      reason: args.reason,
      summary: args.summary,
      tags: normalizeTags(args.tags),
      confidence,
      importance: defaults.importance,
      stability: defaults.stability,
      privacy: defaults.privacy,
      embeddingStatus: "pending",
      embeddingRetryCount: memory.embeddingRetryCount ?? defaults.embeddingRetryCount,
      updatedAt: now,
    };
  },
});
