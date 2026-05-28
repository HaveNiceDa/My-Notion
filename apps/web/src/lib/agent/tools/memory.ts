import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { retrieveRelevantMemories, syncAgentMemory } from "@notion/ai/server";
import { invalidateToolResultCache } from "../tool-result-cache";
import type { ToolContext } from "./types";

type MemoryType = "preference" | "project" | "episodic";
type MemorySource = "user_explicit" | "agent_proposed" | "manual";

const MEMORY_TYPES = new Set<MemoryType>(["preference", "project", "episodic"]);
const MEMORY_SOURCES = new Set<MemorySource>(["user_explicit", "agent_proposed", "manual"]);

interface MemoryWritePreview {
  type: MemoryType;
  content: string;
  source: MemorySource;
  reason?: string;
  confidence: number;
  expiresAt?: number;
}

export async function executeMemoryRead(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  if (!context.convex) {
    return { memories: [], error: "Convex client is not available", recoverable: true };
  }

  const query = typeof args.query === "string" ? args.query : undefined;
  const type = parseMemoryType(args.type);
  const limit = typeof args.limit === "number" ? Math.min(Math.max(Math.floor(args.limit), 1), 20) : 8;

  try {
    const memories = await context.convex.query(api.agentMemories.listAgentMemories, {
      query: undefined,
      type,
      limit: 100,
    });
    const retrieval = query
      ? await retrieveRelevantMemories({
        userId: context.userId,
        query,
        memories,
        topK: limit,
      })
      : { memories: memories.slice(0, limit), retrieval: "fallback" as const };

    return {
      query,
      type,
      memories: retrieval.memories,
      metadata: {
        count: retrieval.memories.length,
        retrieval: retrieval.retrieval,
        unavailable: retrieval.unavailable,
        error: retrieval.error,
      },
    };
  } catch (error) {
    return {
      query,
      type,
      memories: [],
      error: error instanceof Error ? error.message : String(error),
      recoverable: true,
    };
  }
}

export async function executeMemoryWrite(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  const preview = buildWritePreview(args);
  if (!preview.content) {
    return { error: "content is required", recoverable: true };
  }

  const dryRun = args.dryRun !== false;
  if (dryRun) {
    return {
      dryRun: true,
      confirmationRequired: true,
      action: "memory_write",
      message:
        "Dry run only. No memory was saved. Set dryRun=false only after explicit user approval.",
      memory: preview,
    };
  }

  if (!context.convex) {
    return { error: "Convex client is not available", recoverable: true };
  }

  try {
    const memory = await context.convex.mutation(api.agentMemories.createAgentMemory, {
      ...preview,
      supersedesMemoryId: typeof args.supersedesMemoryId === "string"
        ? args.supersedesMemoryId as Id<"agentMemories">
        : undefined,
    });
    invalidateToolResultCache({ userId: context.userId, toolNames: ["memory_read"] });
    const syncWarning = await syncMemorySafely(context.userId, memory);

    return {
      dryRun: false,
      action: "memory_write",
      message: "Memory saved.",
      memory,
      warning: syncWarning,
    };
  } catch (error) {
    return {
      dryRun: false,
      action: "memory_write",
      error: error instanceof Error ? error.message : String(error),
      recoverable: true,
    };
  }
}

async function syncMemorySafely(
  userId: string,
  memory: {
    id: Id<"agentMemories">;
    type: MemoryType;
    content: string;
    reason?: string;
    confidence: number;
    source: MemorySource;
    updatedAt: number;
  },
): Promise<string | undefined> {
  try {
    await syncAgentMemory({
      userId,
      memory: {
        id: memory.id,
        type: memory.type,
        content: memory.content,
        reason: memory.reason,
        confidence: memory.confidence,
        source: memory.source,
        updatedAt: memory.updatedAt,
      },
    });
    return undefined;
  } catch (error) {
    console.warn("[Agent Memory Sync] memory_write sync failed:", error);
    return "Memory saved but vector index sync failed.";
  }
}

function buildWritePreview(args: Record<string, unknown>): MemoryWritePreview {
  return {
    type: parseMemoryType(args.type) ?? "episodic",
    content: typeof args.content === "string" ? args.content.trim() : "",
    source: parseMemorySource(args.source) ?? "agent_proposed",
    reason: typeof args.reason === "string" && args.reason.trim() ? args.reason.trim() : undefined,
    confidence: clampConfidence(args.confidence),
    expiresAt: typeof args.expiresAt === "number" && Number.isFinite(args.expiresAt)
      ? args.expiresAt
      : undefined,
  };
}

function parseMemoryType(value: unknown): MemoryType | undefined {
  return typeof value === "string" && MEMORY_TYPES.has(value as MemoryType)
    ? value as MemoryType
    : undefined;
}

function parseMemorySource(value: unknown): MemorySource | undefined {
  return typeof value === "string" && MEMORY_SOURCES.has(value as MemorySource)
    ? value as MemorySource
    : undefined;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  return Math.min(Math.max(value, 0), 1);
}
