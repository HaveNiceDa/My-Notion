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
