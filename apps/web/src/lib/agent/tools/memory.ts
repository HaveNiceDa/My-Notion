import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { retrieveRelevantMemories, syncAgentMemory } from "@notion/ai/server";
import type { AgentMemoryRecord, RelevantMemoryResult } from "@notion/ai/server";
import { invalidateToolResultCache } from "../tool-result-cache";
import type { ToolContext } from "./types";

type MemoryType = "preference" | "project" | "episodic";
type MemorySource = "user_explicit" | "agent_proposed" | "manual" | "auto_extracted" | "system";

const MEMORY_TYPES = new Set<MemoryType>(["preference", "project", "episodic"]);
const MEMORY_SOURCES = new Set<MemorySource>([
  "user_explicit",
  "agent_proposed",
  "manual",
  "auto_extracted",
  "system",
]);
interface MemoryWritePreview {
  type: MemoryType;
  content: string;
  source: MemorySource;
  reason?: string;
  confidence: number;
  evidenceText?: string;
}

export async function executeMemorySearch(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  if (!context.convex) {
    return { memories: [], error: "Convex client is not available", recoverable: true };
  }

  const query = typeof args.query === "string" ? args.query : undefined;
  const type = parseMemoryType(args.type);
  const types = parseMemoryTypes(args.types, type);
  const limit = typeof args.limit === "number" ? Math.min(Math.max(Math.floor(args.limit), 1), 20) : 8;

  try {
    const memories = await context.convex.query(api.agentMemories.listAgentMemories, {
      query: undefined,
      type: types.length === 1 ? types[0] : undefined,
      limit: 100,
    });
    const filteredMemories = memories.filter((memory) =>
      matchesTypes(memory, types)
    );
    const retrieval: RelevantMemoryResult = query
      ? await retrieveRelevantMemories({
        userId: context.userId,
        query,
        memories: filteredMemories,
        topK: limit,
      })
      : { memories: filteredMemories.slice(0, limit) as AgentMemoryRecord[], retrieval: "fallback" };
    const normalizedMemories = retrieval.memories.map((memory) =>
      normalizeMemoryResult(memory as unknown as Record<string, unknown>),
    );
    context.trace?.mark("memory_search", {
      toolName: "memory_search",
      queryLength: query?.length ?? 0,
      resultCount: normalizedMemories.length,
      retrieval: retrieval.retrieval,
      memoryIds: normalizedMemories.map((memory) => memory.id).filter(Boolean),
      unavailable: retrieval.unavailable,
    });

    return {
      query,
      type,
      types: types.length > 0 ? types : undefined,
      memories: normalizedMemories,
      metadata: {
        count: normalizedMemories.length,
        retrieval: retrieval.retrieval,
        unavailable: retrieval.unavailable,
        error: retrieval.error,
        memoryIds: normalizedMemories.map((memory) => memory.id).filter(Boolean),
        toolName: "memory_search",
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
  if (!context.convex) {
    return {
      dryRun: true,
      confirmationRequired: true,
      action: "memory_propose",
      message: "Convex client is not available. Preview only; no proposal was created.",
      memory: preview,
    };
  }

  try {
    if (dryRun) {
      const proposal = await context.convex.mutation(api.agentMemories.proposeAgentMemory, {
        ...preview,
      });
      invalidateToolResultCache({ userId: context.userId, toolNames: ["memory_search"] });
      context.trace?.mark("memory_proposed", {
        proposalId: String(proposal.id),
        source: preview.source,
        type: preview.type,
        contentLength: preview.content.length,
      });

      return {
        dryRun: true,
        confirmationRequired: true,
        action: "memory_propose",
        message: "Memory proposal created in Inbox. Confirm to activate it, or cancel to reject it.",
        proposalId: proposal.id,
        proposalStatus: proposal.status,
        memory: proposal,
      };
    }

    const memory = await context.convex.mutation(api.agentMemories.createAgentMemory, {
      ...preview,
    });
    invalidateToolResultCache({ userId: context.userId, toolNames: ["memory_search"] });
    const syncWarning = await syncMemorySafely(context.userId, memory);
    context.trace?.mark("memory_committed", {
      memoryId: String(memory.id),
      source: preview.source,
      type: preview.type,
      contentLength: preview.content.length,
      syncWarning,
    });

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
    evidenceText: typeof args.evidenceText === "string" && args.evidenceText.trim()
      ? args.evidenceText.trim()
      : undefined,
  };
}

function parseMemoryType(value: unknown): MemoryType | undefined {
  return typeof value === "string" && MEMORY_TYPES.has(value as MemoryType)
    ? value as MemoryType
    : undefined;
}

function parseMemoryTypes(value: unknown, fallback?: MemoryType): MemoryType[] {
  const values = Array.isArray(value) ? value : [];
  const parsed = values.flatMap((item) => {
    const type = parseMemoryType(item);
    return type ? [type] : [];
  });
  return parsed.length > 0 ? Array.from(new Set(parsed)) : fallback ? [fallback] : [];
}

function matchesTypes(memory: { type?: string }, types: MemoryType[]): boolean {
  return types.length === 0 || types.includes(memory.type as MemoryType);
}

function normalizeMemoryResult(memory: Record<string, unknown>) {
  return {
    id: memory.id,
    type: memory.type,
    content: memory.content,
    summary: memory.summary,
    source: memory.source,
    reason: memory.reason,
    updatedAt: memory.updatedAt,
    score: memory.matchScore,
  };
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
