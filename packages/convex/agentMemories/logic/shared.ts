import {
  clampScore,
  deriveMemoryDefaults,
  type LegacyMemoryType,
} from "../model";

export interface MemoryWriteInput {
  type: LegacyMemoryType;
  content: string;
  reason?: string;
  summary?: string;
  tags?: string[];
  evidenceText?: string;
  confidence?: number;
}

export function buildMemoryPatch(input: MemoryWriteInput, userId: string) {
  const content = input.content.trim();
  if (!content) {
    throw new Error("content is required");
  }

  const defaults = deriveMemoryDefaults(input.type, userId);
  return {
    type: input.type,
    kind: defaults.kind,
    category: defaults.category,
    scopeLevel: defaults.scopeLevel,
    scopeKey: defaults.scopeKey,
    content,
    reason: input.reason?.trim() || undefined,
    summary: input.summary?.trim() || undefined,
    tags: normalizeTags(input.tags),
    evidenceText: input.evidenceText?.trim() || undefined,
    confidence: clampScore(input.confidence, 1),
    importance: defaults.importance,
    stability: defaults.stability,
    privacy: defaults.privacy,
    usageCount: defaults.usageCount,
    embeddingStatus: defaults.embeddingStatus,
    embeddingRetryCount: defaults.embeddingRetryCount,
  };
}

export function normalizeTags(tags: string[] | undefined): string[] | undefined {
  const normalized = (tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
  return normalized.length > 0 ? normalized : undefined;
}
