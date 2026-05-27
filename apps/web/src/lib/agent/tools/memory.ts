import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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
      query,
      type,
      limit,
    });

    return {
      query,
      type,
      memories,
      metadata: {
        count: Array.isArray(memories) ? memories.length : 0,
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

    return {
      dryRun: false,
      action: "memory_write",
      message: "Memory saved.",
      memory,
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
