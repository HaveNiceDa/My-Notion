import { mutation, query } from "@convex/server";
import type { MutationCtx, QueryCtx } from "@convex/server";
import type { Id } from "@convex/dataModel";
import { v } from "convex/values";

const RUN_TTL_MS = 24 * 60 * 60 * 1000;

const runStatusValidator = v.union(
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);

type AgentRunCtx = MutationCtx | QueryCtx;

async function requireUserId(ctx: AgentRunCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  return identity.subject;
}

async function requireConversationOwner(
  ctx: AgentRunCtx,
  conversationId: Id<"aiConversations">,
  userId: string,
) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) throw new Error("Conversation not found");
  if (conversation.userId !== userId) throw new Error("Unauthorized");
  return conversation;
}

async function requireRunOwner(ctx: AgentRunCtx, runId: string, userId: string) {
  const run = await ctx.db
    .query("agentRuns")
    .withIndex("by_run", (q) => q.eq("runId", runId))
    .first();
  if (!run) throw new Error("Agent run not found");
  if (run.userId !== userId) throw new Error("Unauthorized");
  return run;
}

export const createAgentRun = mutation({
  args: {
    runId: v.string(),
    conversationId: v.id("aiConversations"),
    assistantMessageId: v.string(),
    model: v.string(),
    mode: v.union(v.literal("chat"), v.literal("plan")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireConversationOwner(ctx, args.conversationId, userId);

    const now = Date.now();
    const existing = await ctx.db
      .query("agentRuns")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("agentRuns", {
      runId: args.runId,
      userId,
      conversationId: args.conversationId,
      assistantMessageId: args.assistantMessageId,
      model: args.model,
      mode: args.mode,
      status: "running",
      lastSeq: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + RUN_TTL_MS,
    });
  },
});

export const appendAgentRunEvent = mutation({
  args: {
    runId: v.string(),
    seq: v.number(),
    eventType: v.string(),
    eventJson: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const run = await requireRunOwner(ctx, args.runId, userId);
    const now = Date.now();

    const existing = await ctx.db
      .query("agentRunEvents")
      .withIndex("by_run_seq", (q) => q.eq("runId", args.runId).eq("seq", args.seq))
      .first();
    if (!existing) {
      await ctx.db.insert("agentRunEvents", {
        runId: args.runId,
        userId,
        seq: args.seq,
        eventType: args.eventType,
        eventJson: args.eventJson,
        createdAt: now,
      });
    }

    if (args.seq > run.lastSeq) {
      await ctx.db.patch(run._id, {
        lastSeq: args.seq,
        updatedAt: now,
      });
    }
  },
});

export const appendAgentRunCheckpoint = mutation({
  args: {
    runId: v.string(),
    seq: v.number(),
    kind: v.string(),
    checkpointJson: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const run = await requireRunOwner(ctx, args.runId, userId);
    const now = Date.now();

    const existing = await ctx.db
      .query("agentRunCheckpoints")
      .withIndex("by_run_seq", (q) => q.eq("runId", args.runId).eq("seq", args.seq))
      .first();
    if (!existing) {
      await ctx.db.insert("agentRunCheckpoints", {
        runId: args.runId,
        userId,
        seq: args.seq,
        kind: args.kind,
        checkpointJson: args.checkpointJson,
        createdAt: now,
      });
    }

    if (args.seq > run.lastSeq) {
      await ctx.db.patch(run._id, {
        lastSeq: args.seq,
        updatedAt: now,
      });
    }
  },
});

export const finishAgentRun = mutation({
  args: {
    runId: v.string(),
    status: runStatusValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const run = await requireRunOwner(ctx, args.runId, userId);
    await ctx.db.patch(run._id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const getAgentRunBacklog = query({
  args: {
    runId: v.string(),
    afterSeq: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const run = await requireRunOwner(ctx, args.runId, userId);
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 1000);
    const events = await ctx.db
      .query("agentRunEvents")
      .withIndex("by_run_seq", (q) => q.eq("runId", args.runId).gt("seq", args.afterSeq))
      .order("asc")
      .take(limit);
    return { run, events };
  },
});

export const getLatestAgentRunCheckpoint = query({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireRunOwner(ctx, args.runId, userId);
    return await ctx.db
      .query("agentRunCheckpoints")
      .withIndex("by_run_seq", (q) => q.eq("runId", args.runId))
      .order("desc")
      .first();
  },
});
