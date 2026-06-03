import { getOrCreateVectorStore } from "./vector-store-cache";

export interface AgentMemoryRecord {
  id: string;
  type: "preference" | "project" | "episodic";
  kind?: "instruction" | "semantic" | "episodic" | "procedural";
  category?: string;
  scopeLevel?: string;
  scopeKey?: string;
  content: string;
  summary?: string;
  reason?: string;
  confidence?: number;
  importance?: number;
  privacy?: "normal" | "sensitive";
  status?: string;
  evidenceConversationId?: string;
  evidenceMessageId?: string;
  evidenceDocumentId?: string;
  evidenceText?: string;
  updatedAt?: number;
  lastUsedAt?: number;
  usageCount?: number;
  reviewDueAt?: number;
  expiresAt?: number;
  source?: string;
  matchScore?: number;
  scoreBreakdown?: MemoryScoreBreakdown;
}

export interface MemoryScope {
  level: string;
  key: string;
}

export interface MemoryScoreBreakdown {
  semantic?: number;
  scope?: number;
  importance?: number;
  confidence?: number;
  recency?: number;
  usage?: number;
  stalenessPenalty?: number;
}

export interface RelevantMemoryResult {
  memories: AgentMemoryRecord[];
  retrieval: "semantic" | "hybrid" | "fallback";
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
  scopes?: MemoryScope[];
}): Promise<RelevantMemoryResult> {
  const topK = Math.min(Math.max(options.topK ?? 8, 1), 20);
  const activeMemories = options.memories.filter((memory) => memory.content.trim());
  if (activeMemories.length === 0) {
    return { memories: [], retrieval: "fallback" };
  }

  try {
    const vectorStore = await getOrCreateVectorStore(options.userId);
    const semanticHits = await vectorStore.semanticSearchAgentMemories(
      options.query,
      activeMemories.map((memory) => memory.id),
      topK,
    );
    const byId = new Map(activeMemories.map((memory) => [memory.id, memory]));
    const memories: AgentMemoryRecord[] = semanticHits
      .flatMap((hit) => {
        const memory = byId.get(hit.memoryId);
        return memory ? [rankMemory(memory, { semanticScore: hit.score, scopes: options.scopes })] : [];
      })
      .sort(sortByMatchScore)
      .slice(0, topK);

    return {
      memories: memories.length > 0
        ? memories
        : fallbackRankMemories(options.query, activeMemories, topK, options.scopes),
      retrieval: memories.length > 0 ? "semantic" : "fallback",
    };
  } catch (error) {
    return {
      memories: fallbackRankMemories(options.query, activeMemories, topK, options.scopes),
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
  scopes?: MemoryScope[],
): AgentMemoryRecord[] {
  const tokens = tokenize(query);
  return memories
    .map((memory) => {
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
      const tokenScore = tokens.length === 0
        ? 1
        : tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
      return rankMemory(memory, {
        semanticScore: Math.min(tokenScore / Math.max(tokens.length, 1), 1),
        scopes,
      });
    })
    .filter((memory) => !tokens.length || (memory.matchScore ?? 0) > 0)
    .sort(sortByMatchScore)
    .slice(0, topK);
}

function rankMemory(
  memory: AgentMemoryRecord,
  options: {
    semanticScore: number;
    scopes?: MemoryScope[];
  },
): AgentMemoryRecord {
  const semantic = clampScore(options.semanticScore);
  const scope = scopeScore(memory, options.scopes);
  const importance = clampScore(memory.importance ?? 0.5);
  const confidence = clampScore(memory.confidence ?? 1);
  const recency = memory.updatedAt ? recencyBoost(memory.updatedAt) : 0;
  const usage = usageBoost(memory.usageCount);
  const stalenessPenalty = stalePenalty(memory);
  const matchScore = Math.max(
    0,
    semantic * 0.45
      + scope * 0.20
      + importance * 0.15
      + confidence * 0.10
      + recency * 0.05
      + usage * 0.05
      - stalenessPenalty,
  );

  return {
    ...memory,
    matchScore,
    scoreBreakdown: {
      semantic,
      scope,
      importance,
      confidence,
      recency,
      usage,
      stalenessPenalty,
    },
  };
}

function scopeScore(memory: AgentMemoryRecord, scopes: MemoryScope[] | undefined): number {
  if (!scopes?.length) return memory.scopeLevel === "user" ? 1 : 0.5;
  if (!memory.scopeLevel || !memory.scopeKey) return 0.25;
  return scopes.some((scope) => scope.level === memory.scopeLevel && scope.key === memory.scopeKey)
    ? 1
    : memory.scopeLevel === "user"
      ? 0.7
      : 0;
}

function usageBoost(usageCount: number | undefined): number {
  if (!usageCount || usageCount <= 0) return 0;
  return Math.min(Math.log10(usageCount + 1) / 2, 1);
}

function stalePenalty(memory: AgentMemoryRecord): number {
  const now = Date.now();
  if (memory.expiresAt && memory.expiresAt <= now) return 1;
  if (memory.reviewDueAt && memory.reviewDueAt <= now) return 0.2;
  return 0;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function sortByMatchScore(a: AgentMemoryRecord, b: AgentMemoryRecord): number {
  return (b.matchScore ?? 0) - (a.matchScore ?? 0);
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
