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

export interface KnowledgeRetrievalResult {
  query: string;
  strategy: RetrievalStrategy;
  items: RetrievalResultItem[];
  metadata: {
    semanticCount: number;
    keywordCount: number;
    metadataCount: number;
    fusedCount: number;
    queryVariants?: QueryRewriteVariant[];
  };
}

export type QueryRewriteVariantKind = "original" | "keyword" | "semantic";

export interface QueryRewriteVariant {
  kind: QueryRewriteVariantKind;
  query: string;
}
