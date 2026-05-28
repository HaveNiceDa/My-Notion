import { describe, expect, it } from "vitest";

import { RETRIEVAL_EVAL_CASES } from "../eval/retrieval-eval-fixtures";
import {
  formatRetrievalEvalSummary,
  runRetrievalEval,
} from "../eval/retrieval-evaluator";

describe("retrieval eval golden set", () => {
  it("全部固定问题集通过，并输出稳定聚合指标", () => {
    const summary = runRetrievalEval(RETRIEVAL_EVAL_CASES);

    expect(summary).toMatchObject({
      cases: 3,
      passed: 3,
      failed: 0,
      recallAtK: 1,
      mrr: 1,
      citationCoverageAvg: 1,
      truncationRate: 1 / 3,
      needsMoreRetrievalRate: 1 / 3,
    });
    expect(formatRetrievalEvalSummary(summary)).toContain("Retrieval Eval Summary");
  });

  it.each(RETRIEVAL_EVAL_CASES)("$id", (evalCase) => {
    const summary = runRetrievalEval([evalCase]);

    expect(summary.failed).toBe(0);
    expect(summary.caseMetrics[0].failures).toEqual([]);
  });
});
