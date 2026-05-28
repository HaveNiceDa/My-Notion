import { RETRIEVAL_EVAL_CASES } from "./retrieval-eval-fixtures";
import {
  formatRetrievalEvalSummary,
  runRetrievalEval,
} from "./retrieval-evaluator";

const summary = runRetrievalEval(RETRIEVAL_EVAL_CASES);

console.log(formatRetrievalEvalSummary(summary));

if (summary.failed > 0) {
  process.exitCode = 1;
}
