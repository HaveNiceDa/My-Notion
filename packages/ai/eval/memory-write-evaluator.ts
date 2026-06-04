export interface MemoryWriteEvalSummary {
  cases: number;
  passed: number;
  failed: number;
}

export function runMemoryWriteEval(): MemoryWriteEvalSummary {
  return { cases: 0, passed: 0, failed: 0 };
}

export function formatMemoryWriteEvalSummary(summary: MemoryWriteEvalSummary): string {
  return [
    "Memory Write Eval Summary",
    `cases: ${summary.cases}`,
    `pass: ${summary.passed}`,
    `fail: ${summary.failed}`,
  ].join("\n");
}
