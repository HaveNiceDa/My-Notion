import { MEMORY_RETRIEVAL_EVAL_CASES } from "./memory-retrieval-eval-fixtures";
import {
  formatMemoryRetrievalEvalSummary,
  runMemoryRetrievalEval,
} from "./memory-retrieval-evaluator";
import {
  formatMemoryWriteEvalSummary,
  runMemoryWriteEval,
} from "./memory-write-evaluator";
import {
  formatMemoryConflictEvalSummary,
  runMemoryConflictEval,
} from "./memory-conflict-evaluator";

const retrievalSummary = runMemoryRetrievalEval(MEMORY_RETRIEVAL_EVAL_CASES);
const writeSummary = runMemoryWriteEval();
const conflictSummary = runMemoryConflictEval();
const failed = retrievalSummary.failed + writeSummary.failed + conflictSummary.failed;

console.log([
  formatMemoryRetrievalEvalSummary(retrievalSummary),
  "",
  formatMemoryWriteEvalSummary(writeSummary),
  "",
  formatMemoryConflictEvalSummary(conflictSummary),
].join("\n"));

if (failed > 0) {
  process.exitCode = 1;
}
