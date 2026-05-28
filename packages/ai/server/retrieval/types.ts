export type RetrievalStrategy = "fast" | "balanced" | "deep";

export type RetrievalSource = "semantic" | "keyword" | "metadata";

export interface KnowledgeRetrievalFilters {
  documentIds?: string[];
  tags?: string[];
  updatedAfter?: number;
}

export interface KnowledgeRetrievalOptions {
  userId: string;
  query: string;
  topK?: number;
  minScore?: number;
  strategy?: RetrievalStrategy;
  contextTokenBudget?: number;
  filters?: KnowledgeRetrievalFilters;
}

export interface RetrievalCandidate {
  documentId: string;
  chunkId: string;
  chunkIndex?: number;
  title: string;
  content: string;
  score: number;
  source: RetrievalSource;
  rank: number;
  metadata: Record<string, unknown>;
}

export interface RetrievalResultItem {
  documentId: string;
  chunkId: string;
  chunkIndex?: number;
  title: string;
  content: string;
  score: number;
  sources: RetrievalSource[];
  metadata: Record<string, unknown>;
}

export interface CitationSourceScoreExplanation {
  source: RetrievalSource;
  score?: number;
  explanation: string;
}

export interface CitationItemQuality {
  documentId: string;
  chunkId: string;
  title: string;
  sources: RetrievalSource[];
  score: number;
  sourceScores: CitationSourceScoreExplanation[];
  packedItemCount: number;
  packedChunkIndexes: number[];
  truncated: boolean;
  explanation: string;
}

export interface CitationQuality {
  citationCoverage: number;
  citedItemCount: number;
  totalItemCount: number;
  uniqueDocumentCount: number;
  sourceCoverage: Partial<Record<RetrievalSource, number>>;
  sourceScoreExplanations: CitationItemQuality[];
  packing: {
    packedCount?: number;
    fusedCount: number;
    mergedItemCount: number;
    contextTokenBudget?: number;
    contextEstimatedTokens?: number;
    contextTruncated?: boolean;
    explanation: string;
  };
  needsMoreRetrieval: boolean;
  explanation: string;
}

export interface KnowledgeRetrievalResult {
  query: string;
  strategy: RetrievalStrategy;
  items: RetrievalResultItem[];
  metadata: {
    semanticCount: number;
    keywordCount: number;
    metadataCount: number;
    fusedCount: number;
    packedCount?: number;
    contextTokenBudget?: number;
    contextEstimatedTokens?: number;
    contextTruncated?: boolean;
    citationQuality?: CitationQuality;
    queryVariants?: QueryRewriteVariant[];
  };
}

export type QueryRewriteVariantKind = "original" | "keyword" | "semantic";

export interface QueryRewriteVariant {
  kind: QueryRewriteVariantKind;
  query: string;
}
