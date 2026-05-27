import type {
  RetrievalCandidate,
  RetrievalResultItem,
  RetrievalSource,
} from "./types";

interface FuseCandidatesOptions {
  candidates: RetrievalCandidate[];
  topK: number;
  weights?: Partial<Record<RetrievalSource, number>>;
}

const RRF_K = 60;

const DEFAULT_WEIGHTS: Record<RetrievalSource, number> = {
  semantic: 1,
  keyword: 0.9,
  metadata: 0.6,
};

export function fuseCandidates(options: FuseCandidatesOptions): RetrievalResultItem[] {
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  const grouped = new Map<
    string,
    {
      candidate: RetrievalCandidate;
      sources: Set<RetrievalSource>;
      score: number;
      sourceScores: Partial<Record<RetrievalSource, number>>;
    }
  >();

  for (const candidate of options.candidates) {
    const key = candidate.chunkId;
    const weightedScore = weights[candidate.source] * (1 / (RRF_K + candidate.rank));
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        candidate,
        sources: new Set([candidate.source]),
        score: weightedScore,
        sourceScores: { [candidate.source]: candidate.score },
      });
      continue;
    }

    existing.sources.add(candidate.source);
    existing.score += weightedScore;
    existing.sourceScores[candidate.source] = candidate.score;

    if (candidate.content.length > existing.candidate.content.length) {
      existing.candidate = candidate;
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, options.topK)
    .map(({ candidate, sources, score, sourceScores }) => ({
      documentId: candidate.documentId,
      chunkId: candidate.chunkId,
      chunkIndex: candidate.chunkIndex,
      title: candidate.title,
      content: candidate.content,
      score: Number(score.toFixed(4)),
      sources: Array.from(sources),
      metadata: {
        ...candidate.metadata,
        sourceScores,
      },
    }));
}
