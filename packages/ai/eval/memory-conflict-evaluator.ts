export type MemoryConflictLabel = "duplicate" | "conflict" | "supersedes" | "none";

export interface MemoryConflictEvalCase {
  id: string;
  existing: {
    id: string;
    content: string;
    kind: string;
    scopeLevel: string;
    scopeKey: string;
  };
  incoming: {
    content: string;
    kind: string;
    scopeLevel: string;
    scopeKey: string;
  };
  expected: MemoryConflictLabel;
}

export interface MemoryConflictCaseMetric {
  id: string;
  passed: boolean;
  predicted: MemoryConflictLabel;
  expected: MemoryConflictLabel;
  overlapScore: number;
  failures: string[];
}

export interface MemoryConflictEvalSummary {
  cases: number;
  passed: number;
  failed: number;
  accuracy: number;
  duplicateRecall: number;
  conflictRecall: number;
  caseMetrics: MemoryConflictCaseMetric[];
}

export const MEMORY_CONFLICT_EVAL_CASES: MemoryConflictEvalCase[] = [
  {
    id: "same-rule-duplicate",
    existing: memory("m1", "Web 表单优先使用 shadcn/ui 组件。"),
    incoming: {
      content: "前端表单控件要优先使用 shadcn/ui 组件。",
      kind: "instruction",
      scopeLevel: "project",
      scopeKey: "web",
    },
    expected: "duplicate",
  },
  {
    id: "new-rule-supersedes-old",
    existing: memory("m2", "CLI 默认连接 local 环境。", "module", "cli"),
    incoming: {
      content: "CLI 默认连接线上 prod，本地调试必须显式使用 --local。",
      kind: "instruction",
      scopeLevel: "module",
      scopeKey: "cli",
    },
    expected: "conflict",
  },
  {
    id: "different-scope-none",
    existing: memory("m3", "移动端 UI 文案必须走 i18n。", "project", "mobile"),
    incoming: {
      content: "Web 端表单优先使用 shadcn/ui。",
      kind: "instruction",
      scopeLevel: "project",
      scopeKey: "web",
    },
    expected: "none",
  },
];

export function runMemoryConflictEval(cases: MemoryConflictEvalCase[] = MEMORY_CONFLICT_EVAL_CASES): MemoryConflictEvalSummary {
  const caseMetrics = cases.map(evaluateMemoryConflictCase);
  return {
    cases: caseMetrics.length,
    passed: caseMetrics.filter((metric) => metric.passed).length,
    failed: caseMetrics.filter((metric) => !metric.passed).length,
    accuracy: average(caseMetrics.map((metric) => metric.passed ? 1 : 0)),
    duplicateRecall: recallForLabel(caseMetrics, "duplicate"),
    conflictRecall: recallForLabel(caseMetrics, "conflict"),
    caseMetrics,
  };
}

export function evaluateMemoryConflictCase(evalCase: MemoryConflictEvalCase): MemoryConflictCaseMetric {
  const overlapScore = contentOverlapScore(evalCase.existing.content, evalCase.incoming.content);
  const predicted = predictConflict(evalCase, overlapScore);
  const failures = predicted === evalCase.expected ? [] : [`predicted ${predicted} != ${evalCase.expected}`];

  return {
    id: evalCase.id,
    passed: failures.length === 0,
    predicted,
    expected: evalCase.expected,
    overlapScore,
    failures,
  };
}

export function formatMemoryConflictEvalSummary(summary: MemoryConflictEvalSummary): string {
  const lines = [
    "Memory Conflict Eval Summary",
    `cases: ${summary.cases}`,
    `pass: ${summary.passed}`,
    `fail: ${summary.failed}`,
    `accuracy: ${formatMetric(summary.accuracy)}`,
    `duplicateRecall: ${formatMetric(summary.duplicateRecall)}`,
    `conflictRecall: ${formatMetric(summary.conflictRecall)}`,
    "",
    "Cases",
    ...summary.caseMetrics.map((metric) =>
      `${metric.passed ? "PASS" : "FAIL"} ${metric.id} predicted=${metric.predicted} expected=${metric.expected} overlap=${formatMetric(metric.overlapScore)}`,
    ),
  ];
  const failures = summary.caseMetrics.flatMap((metric) =>
    metric.failures.map((failure) => `${metric.id}: ${failure}`),
  );
  if (failures.length > 0) {
    lines.push("", "Failures", ...failures);
  }
  return lines.join("\n");
}

function predictConflict(evalCase: MemoryConflictEvalCase, overlapScore: number): MemoryConflictLabel {
  if (!sameScope(evalCase) || evalCase.existing.kind !== evalCase.incoming.kind) {
    return "none";
  }
  if (hasConflictMarker(evalCase.existing.content, evalCase.incoming.content)) {
    return "conflict";
  }
  if (overlapScore >= 0.35) {
    return "duplicate";
  }
  return "none";
}

function sameScope(evalCase: MemoryConflictEvalCase): boolean {
  return evalCase.existing.scopeLevel === evalCase.incoming.scopeLevel
    && evalCase.existing.scopeKey === evalCase.incoming.scopeKey;
}

function hasConflictMarker(left: string, right: string): boolean {
  const combined = `${left}\n${right}`;
  return /默认连接\s*local/.test(combined) && /默认连接线上\s*prod/.test(combined);
}

function contentOverlapScore(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;
  const rightSet = new Set(rightTokens);
  const intersection = leftTokens.filter((token) => rightSet.has(token)).length;
  return intersection / Math.max(leftTokens.length, rightTokens.length);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function recallForLabel(metrics: MemoryConflictCaseMetric[], label: MemoryConflictLabel): number {
  const expected = metrics.filter((metric) => metric.expected === label);
  if (expected.length === 0) return 1;
  return expected.filter((metric) => metric.predicted === label).length / expected.length;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMetric(value: number): string {
  return value.toFixed(2);
}

function memory(
  id: string,
  content: string,
  scopeLevel = "project",
  scopeKey = "web",
) {
  return {
    id,
    content,
    kind: "instruction",
    scopeLevel,
    scopeKey,
  };
}
