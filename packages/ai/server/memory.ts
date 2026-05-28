import { getOrCreateVectorStore } from "./vector-store-cache";

export interface AgentMemoryRecord {
  id: string;
  type: "preference" | "project" | "episodic";
  content: string;
  reason?: string;
  confidence?: number;
  source?: string;
  updatedAt?: number;
  matchScore?: number;
}

export interface RelevantMemoryResult {
  memories: AgentMemoryRecord[];
  retrieval: "semantic" | "fallback";
  unavailable?: boolean;
  error?: string;
}

export interface AgentMemorySyncParams {
  userId: string;
  memory: AgentMemoryRecord;
}

export interface AgentMemoryDeleteParams {
  userId: string;
  memoryId: string;
}

export async function syncAgentMemory(params: AgentMemorySyncParams): Promise<void> {
  const vectorStore = await getOrCreateVectorStore(params.userId);
  await vectorStore.upsertAgentMemory(params.userId, params.memory);
}

export async function deleteAgentMemoryIndex(params: AgentMemoryDeleteParams): Promise<void> {
  const vectorStore = await getOrCreateVectorStore(params.userId);
  await vectorStore.deleteDocumentChunks(memoryDocumentId(params.memoryId));
}

export async function retrieveRelevantMemories(options: {
  userId: string;
  query: string;
  memories: AgentMemoryRecord[];
  topK?: number;
}): Promise<RelevantMemoryResult> {
  const topK = Math.min(Math.max(options.topK ?? 8, 1), 20);
  const activeMemories = options.memories.filter((memory) => memory.content.trim());
  if (activeMemories.length === 0) {
    return { memories: [], retrieval: "fallback" };
  }

  try {
    const vectorStore = await getOrCreateVectorStore(options.userId);
    await Promise.all(
      activeMemories.map((memory) => vectorStore.upsertAgentMemory(options.userId, memory)),
    );

    const semanticHits = await vectorStore.semanticSearchAgentMemories(
      options.query,
      activeMemories.map((memory) => memory.id),
      topK,
    );
    const byId = new Map(activeMemories.map((memory) => [memory.id, memory]));
    const memories: AgentMemoryRecord[] = semanticHits
      .flatMap((hit) => {
        const memory = byId.get(hit.memoryId);
        return memory ? [{ ...memory, matchScore: hit.score }] : [];
      });

    return {
      memories: memories.length > 0
        ? memories
        : fallbackRankMemories(options.query, activeMemories, topK),
      retrieval: memories.length > 0 ? "semantic" : "fallback",
    };
  } catch (error) {
    return {
      memories: fallbackRankMemories(options.query, activeMemories, topK),
      retrieval: "fallback",
      unavailable: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function fallbackRankMemories(
  query: string,
  memories: AgentMemoryRecord[],
  topK: number,
): AgentMemoryRecord[] {
  const tokens = tokenize(query);
  return memories
    .map((memory) => {
      const haystack = `${memory.type} ${memory.content} ${memory.reason ?? ""}`.toLowerCase();
      const tokenScore = tokens.length === 0
        ? 1
        : tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
      const recencyScore = memory.updatedAt ? recencyBoost(memory.updatedAt) : 0;
      return { ...memory, matchScore: tokenScore + recencyScore };
    })
    .filter((memory) => !tokens.length || (memory.matchScore ?? 0) > 0)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, topK);
}

function tokenize(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return Array.from(new Set([
    normalized,
    ...normalized
      .split(/[\s,，.。:：;；/\\()[\]{}'"`|]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  ]));
}

function recencyBoost(updatedAt: number): number {
  const ageInDays = Math.max(0, (Date.now() - updatedAt) / 86_400_000);
  if (ageInDays <= 7) return 0.5;
  if (ageInDays <= 30) return 0.2;
  return 0;
}

function memoryDocumentId(memoryId: string): string {
  return `memory:${memoryId}`;
}
