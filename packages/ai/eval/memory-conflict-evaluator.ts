export interface MemoryConflictEvalSummary {
  cases: number;
  passed: number;
  failed: number;
}

export function runMemoryConflictEval(): MemoryConflictEvalSummary {
  return { cases: 0, passed: 0, failed: 0 };
}

export function formatMemoryConflictEvalSummary(summary: MemoryConflictEvalSummary): string {
  return [
    "Memory Conflict Eval Summary",
    `cases: ${summary.cases}`,
    `pass: ${summary.passed}`,
    `fail: ${summary.failed}`,
  ].join("\n");
}
