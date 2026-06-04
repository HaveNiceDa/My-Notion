import {
  clampScore,
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

export function buildMemoryPatch(input: MemoryWriteInput) {
  const content = input.content.trim();
  if (!content) {
    throw new Error("content is required");
  }

  return {
    type: input.type,
    content,
    reason: input.reason?.trim() || undefined,
    summary: input.summary?.trim() || undefined,
    tags: normalizeTags(input.tags),
    evidenceText: input.evidenceText?.trim() || undefined,
    confidence: clampScore(input.confidence, 1),
  };
}

export function normalizeTags(tags: string[] | undefined): string[] | undefined {
  const normalized = (tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
  return normalized.length > 0 ? normalized : undefined;
}
