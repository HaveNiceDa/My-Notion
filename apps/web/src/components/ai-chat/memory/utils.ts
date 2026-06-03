import type {
  ActiveMemoryFilters,
  AgentMemoryItem,
  MemoryEditState,
  MemoryType,
} from "./types";

export const MEMORY_TYPES: MemoryType[] = ["preference", "project", "episodic"];
export const MEMORY_KINDS = ["instruction", "semantic", "episodic", "procedural"] as const;
export const EMBEDDING_STATUSES = ["pending", "synced", "failed", "skipped"] as const;
export const PRIVACY_LEVELS = ["normal", "sensitive"] as const;

export function createEditState(memory?: AgentMemoryItem): MemoryEditState {
  return {
    type: memory?.type ?? "preference",
    content: memory?.content ?? "",
    reason: memory?.reason ?? "",
    confidence: String(memory?.confidence ?? 1),
  };
}

export function validateEditState(state: MemoryEditState): { content: string; confidence: number } {
  const content = state.content.trim();
  const confidence = Number(state.confidence);
  if (!content) {
    throw new Error("contentRequired");
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("confidenceInvalid");
  }
  return { content, confidence };
}

export function filterActiveMemories(
  memories: AgentMemoryItem[],
  filters: ActiveMemoryFilters,
): AgentMemoryItem[] {
  const query = filters.query.trim().toLowerCase();
  return memories
    .filter((memory) => filters.type === "all" || memory.type === filters.type)
    .filter((memory) => filters.kind === "all" || memory.kind === filters.kind)
    .filter((memory) =>
      filters.embeddingStatus === "all" || memory.embeddingStatus === filters.embeddingStatus,
    )
    .filter((memory) => filters.privacy === "all" || memory.privacy === filters.privacy)
    .filter((memory) => {
      if (!query) return true;
      const haystack = [
        memory.type,
        memory.kind,
        memory.category,
        memory.scopeLevel,
        memory.scopeKey,
        memory.content,
        memory.summary,
        memory.reason,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (filters.sort === "importance_desc") {
        return (b.importance ?? 0) - (a.importance ?? 0);
      }
      if (filters.sort === "usage_desc") {
        return (b.usageCount ?? 0) - (a.usageCount ?? 0);
      }
      if (filters.sort === "review_due") {
        return (a.reviewDueAt ?? Number.MAX_SAFE_INTEGER) - (b.reviewDueAt ?? Number.MAX_SAFE_INTEGER);
      }
      return b.updatedAt - a.updatedAt;
    });
}

export function buildMemoryMetrics(active: AgentMemoryItem[], pending: AgentMemoryItem[]) {
  const now = Date.now();
  return {
    activeCount: active.length,
    pendingCount: pending.length,
    syncFailedCount: active.filter((memory) => memory.embeddingStatus === "failed").length,
    reviewDueCount: active.filter((memory) => memory.reviewDueAt && memory.reviewDueAt <= now).length,
    sensitiveCount: active.filter((memory) => memory.privacy === "sensitive").length,
    recentlyUsedCount: active.filter((memory) => memory.lastUsedAt).length,
    autoExtractedPendingCount: pending.filter((memory) => memory.source === "auto_extracted").length,
  };
}

export function formatDate(value: number | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function scopeLabel(memory: AgentMemoryItem): string {
  if (!memory.scopeLevel || !memory.scopeKey) return "user";
  return `${memory.scopeLevel}:${memory.scopeKey}`;
}
