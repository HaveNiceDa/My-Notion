import { mutation } from "@convex/server";
import { v } from "convex/values";

const toolResultStatusValidator = v.union(
  v.literal("saved"),
  v.literal("cancelled"),
  v.literal("inbox"),
  v.literal("applied"),
  v.literal("started"),
);

export const updateToolResultState = mutation({
  args: {
    messageId: v.id("aiMessages"),
    toolCallId: v.string(),
    status: toolResultStatusValidator,
    proposalId: v.optional(v.id("agentMemories")),
    savedMemoryId: v.optional(v.id("agentMemories")),
    savedDocumentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message || message.role !== "assistant") {
      throw new Error("Message not found");
    }

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const parsedContent = parseMessageContent(message.content);
    const toolResults = parseToolResults(parsedContent.toolResults);
    const nextToolResults = toolResults.map((toolResult) => {
      if (toolResult.id !== args.toolCallId) {
        return toolResult;
      }
      const isMemoryWrite = toolResult.name === "memory_write";
      const isDocumentWrite =
        toolResult.name === "document_write" || toolResult.name === "document_update";
      const isTaskPlan = toolResult.name === "task_plan";
      if (!isMemoryWrite && !isDocumentWrite && !isTaskPlan) {
        return toolResult;
      }

      const result = typeof toolResult.result === "object" && toolResult.result !== null
        ? toolResult.result as Record<string, unknown>
        : {};

      return {
        ...toolResult,
        result: {
          ...result,
          ...buildToolResultStatePatch({
            status: args.status,
            isMemoryWrite,
            isTaskPlan,
            proposalId: args.proposalId,
            savedMemoryId: args.savedMemoryId,
            savedDocumentId: args.savedDocumentId,
          }),
          confirmationRequired: false,
        },
      };
    });

    await ctx.db.patch(args.messageId, {
      content: JSON.stringify({
        ...parsedContent,
        toolResults: nextToolResults,
      }),
    });

    return { id: args.messageId, toolCallId: args.toolCallId, status: args.status };
  },
});

function parseMessageContent(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {}

  return { content };
}

function buildToolResultStatePatch(args: {
  status: string;
  isMemoryWrite: boolean;
  isTaskPlan: boolean;
  proposalId?: string;
  savedMemoryId?: string;
  savedDocumentId?: string;
}) {
  if (args.isMemoryWrite) {
    return {
      memoryWriteStatus: args.status,
      proposalId: args.proposalId,
      savedMemoryId: args.savedMemoryId,
    };
  }
  if (args.isTaskPlan) {
    return { planExecutionStatus: args.status };
  }
  return {
    documentWriteStatus: args.status,
    savedDocumentId: args.savedDocumentId,
  };
}

function parseToolResults(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
