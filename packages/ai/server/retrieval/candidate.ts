import type { Document } from "@langchain/core/documents";

import type { RetrievalCandidate, RetrievalSource } from "./types";

export interface DocumentSearchResult {
  document: Document;
  score: number;
}

export function createRetrievalCandidate(
  result: DocumentSearchResult,
  source: RetrievalSource,
  rank: number,
): RetrievalCandidate {
  const metadata = normalizeMetadata(result.document.metadata);
  const documentId = stringValue(metadata.documentId);
  const chunkIndex = numberValue(metadata.chunkIndex);

  return {
    documentId,
    chunkId: buildChunkId(documentId, chunkIndex, result.document.pageContent, rank),
    chunkIndex,
    title: stringValue(metadata.title),
    content: result.document.pageContent,
    score: result.score,
    source,
    rank,
    metadata,
  };
}

export function buildChunkId(
  documentId: string,
  chunkIndex: number | undefined,
  content: string,
  rank: number,
): string {
  if (documentId && chunkIndex !== undefined) {
    return `${documentId}:${chunkIndex}`;
  }

  return `${documentId || "unknown"}:${content.slice(0, 32)}:${rank}`;
}

function normalizeMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }

  return {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
