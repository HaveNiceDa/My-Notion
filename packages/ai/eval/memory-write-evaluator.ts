export type MemoryWriteKind = "instruction" | "semantic" | "episodic" | "procedural";
export type MemoryWriteScopeLevel = "user" | "workspace" | "project" | "document" | "conversation" | "module" | "path";

export interface MemoryWriteEvalCase {
  id: string;
  proposal: {
    kind: MemoryWriteKind;
    scopeLevel: MemoryWriteScopeLevel;
    content: string;
    evidenceText?: string;
    confidence: number;
    importance: number;
    privacy?: "normal" | "sensitive";
  };
  expected: {
    accepted: boolean;
    kind?: MemoryWriteKind;
    scopeLevel?: MemoryWriteScopeLevel;
    sensitive?: boolean;
  };
}

export interface MemoryWriteCaseMetric {
  id: string;
  passed: boolean;
  accepted: boolean;
  qualityScore: number;
  failures: string[];
}

export interface MemoryWriteEvalSummary {
  cases: number;
  passed: number;
  failed: number;
  acceptanceAccuracy: number;
  averageQualityScore: number;
  caseMetrics: MemoryWriteCaseMetric[];
}

export const MEMORY_WRITE_EVAL_CASES: MemoryWriteEvalCase[] = [
  {
    id: "explicit-user-preference",
    proposal: {
      kind: "instruction",
      scopeLevel: "user",
      content: "用户偏好中文沟通，回答要专业、精炼且目标导向。",
      evidenceText: "以后请都用中文，直接给结论和方案。",
      confidence: 0.9,
      importance: 0.8,
    },
    expected: { accepted: true, kind: "instruction", scopeLevel: "user" },
  },
  {
    id: "one-off-task-state",
    proposal: {
      kind: "episodic",
      scopeLevel: "conversation",
      content: "用户刚才运行了一次 lint。",
      evidenceText: "lint 已通过。",
      confidence: 0.8,
      importance: 0.2,
    },
    expected: { accepted: false },
  },
  {
    id: "sensitive-secret",
    proposal: {
      kind: "semantic",
      scopeLevel: "user",
      content: "用户的 API Token 是 sk-test-123。",
      evidenceText: "我的 token 是 sk-test-123。",
      confidence: 0.9,
      importance: 0.7,
      privacy: "sensitive",
    },
    expected: { accepted: false, sensitive: true },
  },
];

export function runMemoryWriteEval(cases: MemoryWriteEvalCase[] = MEMORY_WRITE_EVAL_CASES): MemoryWriteEvalSummary {
  const caseMetrics = cases.map(evaluateMemoryWriteCase);
  return {
    cases: caseMetrics.length,
    passed: caseMetrics.filter((metric) => metric.passed).length,
    failed: caseMetrics.filter((metric) => !metric.passed).length,
    acceptanceAccuracy: average(caseMetrics.map((metric) => metric.passed ? 1 : 0)),
    averageQualityScore: average(caseMetrics.map((metric) => metric.qualityScore)),
    caseMetrics,
  };
}

export function evaluateMemoryWriteCase(evalCase: MemoryWriteEvalCase): MemoryWriteCaseMetric {
  const qualityScore = scoreProposal(evalCase.proposal);
  const accepted = qualityScore >= 0.65
    && evalCase.proposal.privacy !== "sensitive"
    && evalCase.proposal.importance >= 0.35
    && !isOneOffState(evalCase.proposal.content);
  const failures: string[] = [];

  if (accepted !== evalCase.expected.accepted) {
    failures.push(`accepted ${accepted} != ${evalCase.expected.accepted}`);
  }
  if (evalCase.expected.kind && evalCase.proposal.kind !== evalCase.expected.kind) {
    failures.push(`kind ${evalCase.proposal.kind} != ${evalCase.expected.kind}`);
  }
  if (evalCase.expected.scopeLevel && evalCase.proposal.scopeLevel !== evalCase.expected.scopeLevel) {
    failures.push(`scopeLevel ${evalCase.proposal.scopeLevel} != ${evalCase.expected.scopeLevel}`);
  }
  if (evalCase.expected.sensitive !== undefined) {
    const sensitive = evalCase.proposal.privacy === "sensitive";
    if (sensitive !== evalCase.expected.sensitive) {
      failures.push(`sensitive ${sensitive} != ${evalCase.expected.sensitive}`);
    }
  }

  return {
    id: evalCase.id,
    passed: failures.length === 0,
    accepted,
    qualityScore,
    failures,
  };
}

export function formatMemoryWriteEvalSummary(summary: MemoryWriteEvalSummary): string {
  const lines = [
    "Memory Write Quality Eval Summary",
    `cases: ${summary.cases}`,
    `pass: ${summary.passed}`,
    `fail: ${summary.failed}`,
    `acceptanceAccuracy: ${formatMetric(summary.acceptanceAccuracy)}`,
    `averageQualityScore: ${formatMetric(summary.averageQualityScore)}`,
    "",
    "Cases",
    ...summary.caseMetrics.map((metric) =>
      `${metric.passed ? "PASS" : "FAIL"} ${metric.id} accepted=${metric.accepted} quality=${formatMetric(metric.qualityScore)}`,
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

function scoreProposal(proposal: MemoryWriteEvalCase["proposal"]): number {
  const contentLengthScore = proposal.content.length >= 12 && proposal.content.length <= 180 ? 0.25 : 0;
  const evidenceScore = proposal.evidenceText ? 0.2 : 0;
  const confidenceScore = Math.min(Math.max(proposal.confidence, 0), 1) * 0.2;
  const importanceScore = Math.min(Math.max(proposal.importance, 0), 1) * 0.2;
  const scopeScore = proposal.scopeLevel === "conversation" ? 0.05 : 0.15;
  const privacyPenalty = proposal.privacy === "sensitive" ? 0.5 : 0;
  return Math.max(0, contentLengthScore + evidenceScore + confidenceScore + importanceScore + scopeScore - privacyPenalty);
}

function isOneOffState(content: string): boolean {
  return /刚才|一次|临时|昨天|今天已|已通过/u.test(content);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMetric(value: number): string {
  return value.toFixed(2);
}
