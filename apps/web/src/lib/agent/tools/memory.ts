import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { retrieveRelevantMemories, syncAgentMemory } from "@notion/ai/server";
import type { AgentMemoryRecord, RelevantMemoryResult } from "@notion/ai/server";
import { invalidateToolResultCache } from "../tool-result-cache";
import type { ToolContext } from "./types";

type MemoryType = "preference" | "project" | "episodic";
type MemoryKind = "instruction" | "semantic" | "episodic" | "procedural";
type MemorySource = "user_explicit" | "agent_proposed" | "manual" | "auto_extracted" | "system";
type MemoryScopeLevel = "user" | "workspace" | "project" | "document" | "conversation" | "module" | "path";

const MEMORY_TYPES = new Set<MemoryType>(["preference", "project", "episodic"]);
const MEMORY_KINDS = new Set<MemoryKind>(["instruction", "semantic", "episodic", "procedural"]);
const MEMORY_SOURCES = new Set<MemorySource>([
  "user_explicit",
  "agent_proposed",
  "manual",
  "auto_extracted",
  "system",
]);
const MEMORY_SCOPE_LEVELS = new Set<MemoryScopeLevel>([
  "user",
  "workspace",
  "project",
  "document",
  "conversation",
  "module",
  "path",
]);

interface MemoryWritePreview {
  type: MemoryType;
  content: string;
  source: MemorySource;
  reason?: string;
  confidence: number;
  expiresAt?: number;
  evidenceConversationId?: Id<"aiConversations">;
  evidenceMessageId?: Id<"aiMessages">;
  evidenceDocumentId?: Id<"documents">;
  evidenceToolCallId?: string;
  evidenceText?: string;
}

interface MemoryScope {
  level: MemoryScopeLevel;
  key: string;
}

export async function executeMemoryRead(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  return executeMemorySearch({ ...args, types: parseMemoryType(args.type) ? [args.type] : undefined }, context, {
    compatToolName: "memory_read",
  });
}

export async function executeMemorySearch(
  args: Record<string, unknown>,
  context: ToolContext,
  options: { compatToolName?: "memory_read" | "memory_search" } = {},
): Promise<unknown> {
  if (!context.convex) {
    return { memories: [], error: "Convex client is not available", recoverable: true };
  }

  const query = typeof args.query === "string" ? args.query : undefined;
  const type = parseMemoryType(args.type);
  const types = parseMemoryTypes(args.types, type);
  const kinds = parseMemoryKinds(args.kinds);
  const categories = parseStringArray(args.categories);
  const scopes = parseMemoryScopes(args.scopes, context);
  const includeSensitive = args.includeSensitive === true;
  const includeEvidence = args.includeEvidence === true;
  const limit = typeof args.limit === "number" ? Math.min(Math.max(Math.floor(args.limit), 1), 20) : 8;

  try {
    const memories = await context.convex.query(api.agentMemories.listAgentMemories, {
      query: undefined,
      type: types.length === 1 ? types[0] : undefined,
      limit: 100,
    });
    const filteredMemories = memories.filter((memory) =>
      matchesTypes(memory, types)
      && matchesKinds(memory, kinds)
      && matchesCategories(memory, categories)
      && matchesScopes(memory, scopes)
      && (includeSensitive || memory.privacy !== "sensitive"),
    );
    const retrieval: RelevantMemoryResult = query
      ? await retrieveRelevantMemories({
        userId: context.userId,
        query,
        memories: filteredMemories,
        topK: limit,
        scopes,
      })
      : { memories: filteredMemories.slice(0, limit) as AgentMemoryRecord[], retrieval: "fallback" };
    const normalizedMemories = retrieval.memories.map((memory) =>
      normalizeMemoryResult(memory as unknown as Record<string, unknown>, { includeEvidence }),
    );

    return {
      query,
      type,
      types: types.length > 0 ? types : undefined,
      kinds: kinds.length > 0 ? kinds : undefined,
      categories: categories.length > 0 ? categories : undefined,
      scopes,
      memories: normalizedMemories,
      metadata: {
        count: normalizedMemories.length,
        retrieval: retrieval.retrieval,
        unavailable: retrieval.unavailable,
        error: retrieval.error,
        memoryIds: normalizedMemories.map((memory) => memory.id).filter(Boolean),
        toolName: options.compatToolName ?? "memory_search",
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
        evidenceConversationId: preview.evidenceConversationId,
        evidenceMessageId: preview.evidenceMessageId,
        evidenceDocumentId: preview.evidenceDocumentId,
        evidenceToolCallId: preview.evidenceToolCallId,
        evidenceText: preview.evidenceText,
      });
      invalidateToolResultCache({ userId: context.userId, toolNames: ["memory_read", "memory_search"] });

      return {
        dryRun: true,
        confirmationRequired: true,
        action: "memory_propose",
        message: "Memory proposal created in Inbox. Confirm to activate it, or cancel to reject it.",
        proposalId: proposal.id,
        proposalStatus: proposal.status,
        memory: proposal,
        possibleDuplicateIds: proposal.possibleDuplicateIds,
        possibleConflictIds: proposal.possibleConflictIds,
      };
    }

    const memory = await context.convex.mutation(api.agentMemories.createAgentMemory, {
      ...preview,
      supersedesMemoryId: typeof args.supersedesMemoryId === "string"
        ? args.supersedesMemoryId as Id<"agentMemories">
        : undefined,
    });
    invalidateToolResultCache({ userId: context.userId, toolNames: ["memory_read", "memory_search"] });
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
    evidenceConversationId: parseAiConversationId(args.evidenceConversationId),
    evidenceMessageId: parseAiMessageId(args.evidenceMessageId),
    evidenceDocumentId: parseDocumentId(args.evidenceDocumentId),
    evidenceToolCallId: typeof args.evidenceToolCallId === "string" && args.evidenceToolCallId.trim()
      ? args.evidenceToolCallId.trim()
      : undefined,
    evidenceText: typeof args.evidenceText === "string" && args.evidenceText.trim()
      ? args.evidenceText.trim()
      : undefined,
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

function parseAiConversationId(value: unknown): Id<"aiConversations"> | undefined {
  return typeof value === "string" && value.trim() ? value.trim() as Id<"aiConversations"> : undefined;
}

function parseAiMessageId(value: unknown): Id<"aiMessages"> | undefined {
  return typeof value === "string" && value.trim() ? value.trim() as Id<"aiMessages"> : undefined;
}

function parseDocumentId(value: unknown): Id<"documents"> | undefined {
  return typeof value === "string" && value.trim() ? value.trim() as Id<"documents"> : undefined;
}

function parseMemoryTypes(value: unknown, fallback?: MemoryType): MemoryType[] {
  const values = Array.isArray(value) ? value : [];
  const parsed = values.flatMap((item) => {
    const type = parseMemoryType(item);
    return type ? [type] : [];
  });
  return parsed.length > 0 ? Array.from(new Set(parsed)) : fallback ? [fallback] : [];
}

function parseMemoryKinds(value: unknown): MemoryKind[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.flatMap((item) =>
    typeof item === "string" && MEMORY_KINDS.has(item as MemoryKind) ? [item as MemoryKind] : [],
  )));
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.flatMap((item) =>
    typeof item === "string" && item.trim() ? [item.trim()] : [],
  )));
}

function parseMemoryScopes(value: unknown, context: ToolContext): MemoryScope[] {
  const scopes: MemoryScope[] = [{ level: "user", key: context.userId }];
  if (context.currentDocument?.id) {
    scopes.push({ level: "document", key: context.currentDocument.id });
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const level = typeof record.level === "string" && MEMORY_SCOPE_LEVELS.has(record.level as MemoryScopeLevel)
        ? record.level as MemoryScopeLevel
        : undefined;
      const key = typeof record.key === "string" && record.key.trim() ? record.key.trim() : undefined;
      if (level && key) scopes.push({ level, key });
    }
  }
  return dedupeScopes(scopes);
}

function dedupeScopes(scopes: MemoryScope[]): MemoryScope[] {
  const seen = new Set<string>();
  return scopes.filter((scope) => {
    const key = `${scope.level}:${scope.key}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesTypes(memory: { type?: string }, types: MemoryType[]): boolean {
  return types.length === 0 || types.includes(memory.type as MemoryType);
}

function matchesKinds(memory: { kind?: string }, kinds: MemoryKind[]): boolean {
  return kinds.length === 0 || kinds.includes(memory.kind as MemoryKind);
}

function matchesCategories(memory: { category?: string }, categories: string[]): boolean {
  return categories.length === 0 || Boolean(memory.category && categories.includes(memory.category));
}

function matchesScopes(memory: { scopeLevel?: string; scopeKey?: string }, scopes: MemoryScope[]): boolean {
  if (scopes.length === 0) return true;
  if (!memory.scopeLevel || !memory.scopeKey) return true;
  return scopes.some((scope) => scope.level === memory.scopeLevel && scope.key === memory.scopeKey)
    || memory.scopeLevel === "user";
}

function normalizeMemoryResult(memory: Record<string, unknown>, options: { includeEvidence: boolean }) {
  const normalized = {
    id: memory.id,
    type: memory.type,
    kind: memory.kind,
    category: memory.category,
    scope: {
      level: memory.scopeLevel,
      key: memory.scopeKey,
    },
    content: memory.content,
    summary: memory.summary,
    source: memory.source,
    reason: memory.reason,
    confidence: memory.confidence,
    importance: memory.importance,
    privacy: memory.privacy,
    status: memory.status,
    expiresAt: memory.expiresAt,
    updatedAt: memory.updatedAt,
    lastUsedAt: memory.lastUsedAt,
    usageCount: memory.usageCount,
    score: memory.matchScore,
    scoreBreakdown: memory.scoreBreakdown,
  };
  return options.includeEvidence
    ? {
      ...normalized,
      evidence: {
        conversationId: memory.evidenceConversationId,
        messageId: memory.evidenceMessageId,
        documentId: memory.evidenceDocumentId,
        sourceText: memory.evidenceText,
      },
    }
    : normalized;
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
