import { mutation } from "@convex/server";
import { v } from "convex/values";
import {
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
    confidence: v.optional(v.number()),
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
      evidenceText: memory.evidenceText,
      confidence: args.confidence ?? memory.confidence,
    });

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
