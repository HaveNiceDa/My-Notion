import type {
  ActiveMemoryFilters,
  AgentMemoryItem,
  MemoryEditState,
  MemoryType,
} from "./types";

export const MEMORY_TYPES: MemoryType[] = ["preference", "project", "episodic"];

export function createEditState(memory?: AgentMemoryItem): MemoryEditState {
  return {
    type: memory?.type ?? "preference",
    content: memory?.content ?? "",
    reason: memory?.reason ?? "",
  };
}

export function validateEditState(state: MemoryEditState): { content: string } {
  const content = state.content.trim();
  if (!content) {
    throw new Error("contentRequired");
  }
  return { content };
}

export function filterActiveMemories(
  memories: AgentMemoryItem[],
  filters: ActiveMemoryFilters,
): AgentMemoryItem[] {
  const query = filters.query.trim().toLowerCase();
  return memories
    .filter((memory) => filters.type === "all" || memory.type === filters.type)
    .filter((memory) => {
      if (!query) return true;
      const haystack = [
        memory.type,
        memory.content,
        memory.summary,
        memory.reason,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
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

export function scopeLabel(memory: AgentMemoryItem): string {
  if (!memory.scopeLevel || !memory.scopeKey) return "user";
  return `${memory.scopeLevel}:${memory.scopeKey}`;
}
