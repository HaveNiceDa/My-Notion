import { mutation } from "@convex/server";
import { v } from "convex/values";
import {
  memorySourceValidator,
  memoryTypeValidator,
} from "../model";
import { buildMemoryPatch } from "./shared";

export const proposeAgentMemory = mutation({
  args: {
    type: memoryTypeValidator,
    content: v.string(),
    source: memorySourceValidator,
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

    const now = Date.now();
    const memoryPatch = buildMemoryPatch(args);
    const memoryId = await ctx.db.insert("agentMemories", {
      userId: identity.subject,
      ...memoryPatch,
      source: args.source,
      status: "pending_review",
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: memoryId,
      ...memoryPatch,
      source: args.source,
      status: "pending_review",
      createdAt: now,
      updatedAt: now,
    };
  },
});
