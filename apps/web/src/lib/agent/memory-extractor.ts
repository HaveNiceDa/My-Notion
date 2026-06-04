import type { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import type { AgentTracer } from "./trace";
import type { CurrentDocumentContext } from "./tools/types";

export type ExtractedMemoryKind = "instruction" | "semantic" | "episodic" | "procedural";
export type ExtractedMemoryType = "preference" | "project" | "episodic";
export type ExtractedMemoryScopeLevel = "user" | "project" | "document" | "conversation" | "module" | "path";

export interface MemoryExtractionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: unknown;
}

export interface ExtractedMemoryCandidate {
  type: ExtractedMemoryType;
  kind: ExtractedMemoryKind;
  category: string;
  scopeLevel: ExtractedMemoryScopeLevel;
  scopeKey: string;
  content: string;
  summary?: string;
  evidenceText: string;
  confidence: number;
  importance: number;
  reason: string;
  privacy: "normal" | "sensitive";
}

export interface MemoryExtractionResult {
  enabled: boolean;
  skippedReason?: "disabled" | "no_signal" | "low_confidence" | "sensitive" | "duplicate_candidate" | "no_evidence";
  proposals: ExtractedMemoryCandidate[];
  rejected: Array<{
    reason: "low_confidence" | "sensitive" | "duplicate_candidate" | "no_evidence";
    evidenceText: string;
  }>;
}

export interface ExtractMemoryCandidatesOptions {
  enabled: boolean;
  userId: string;
  conversationId?: string;
  messages: MemoryExtractionMessage[];
  currentDocument?: CurrentDocumentContext | null;
  minConfidence?: number;
  maxProposals?: number;
  allowSensitive?: boolean;
}

export interface ProposeExtractedMemoriesOptions {
  convex: ConvexHttpClient | null;
  userId: string;
  conversationId?: string;
  extraction: MemoryExtractionResult;
  trace?: AgentTracer;
}

export interface ProposeExtractedMemoriesResult {
  proposalIds: string[];
  skipped: boolean;
  reason?: string;
}

const EXPLICIT_MEMORY_PATTERNS = [
  /(?:记住|请记住|帮我记住)(.+)/u,
  /(?:以后|后续)(.+)/u,
  /(?:我偏好|我喜欢|我希望)(.+)/u,
  /(?:不要|别)(.+)/u,
];

const SENSITIVE_PATTERN = /(token|api[_-]?key|secret|password|密码|密钥|身份证|手机号|邮箱|sk-[a-z0-9_-]+)/iu;
const PREFERENCE_PATTERN = /(偏好|喜欢|希望|不要|别|禁止|不能|回答|沟通|语气|风格)/iu;
const PROJECT_RULE_PATTERN = /(项目|文档|画板|白板|workspace|document|whiteboard|规则|约束|流程)/iu;
const DECISION_PATTERN = /(决定|结论|决策|方案|取舍|本次|这次|当前任务)/iu;
const MAX_CONTENT_LENGTH = 180;
const MAX_EVIDENCE_LENGTH = 400;

export function extractMemoryCandidates(options: ExtractMemoryCandidatesOptions): MemoryExtractionResult {
  if (!options.enabled) {
    return { enabled: false, skippedReason: "disabled", proposals: [], rejected: [] };
  }

  const minConfidence = options.minConfidence ?? 0.72;
  const maxProposals = options.maxProposals ?? 3;
  const rejected: MemoryExtractionResult["rejected"] = [];
  const proposals: ExtractedMemoryCandidate[] = [];

  for (const message of options.messages) {
    if (message.role !== "user") continue;
    const text = stringifyMessageContent(message.content).trim();
    if (!text) continue;

    const signal = extractSignal(text);
    if (!signal) continue;

    const sensitive = SENSITIVE_PATTERN.test(signal.content) || SENSITIVE_PATTERN.test(text);
    if (sensitive && !options.allowSensitive) {
      rejected.push({ reason: "sensitive", evidenceText: truncate(text, MAX_EVIDENCE_LENGTH) });
      continue;
    }

    const candidate = buildCandidate({
      userId: options.userId,
      conversationId: options.conversationId,
      currentDocument: options.currentDocument,
      signal,
      evidenceText: text,
      sensitive,
    });
    if (candidate.confidence < minConfidence) {
      rejected.push({ reason: "low_confidence", evidenceText: candidate.evidenceText });
      continue;
    }

    proposals.push(candidate);
    if (proposals.length >= maxProposals) break;
  }

  if (proposals.length === 0) {
    return {
      enabled: true,
      skippedReason: rejected.length > 0 ? rejected[0]?.reason : "no_signal",
      proposals,
      rejected,
    };
  }

  return { enabled: true, proposals: dedupeCandidates(proposals), rejected };
}

export async function proposeExtractedMemories(
  options: ProposeExtractedMemoriesOptions,
): Promise<ProposeExtractedMemoriesResult> {
  if (!options.convex) {
    return { proposalIds: [], skipped: true, reason: "convex_unavailable" };
  }
  if (!options.extraction.enabled || options.extraction.proposals.length === 0) {
    options.trace?.mark("memory_extraction_skipped", {
      reason: options.extraction.skippedReason ?? "no_proposals",
      rejectedCount: options.extraction.rejected.length,
    });
    return { proposalIds: [], skipped: true, reason: options.extraction.skippedReason ?? "no_proposals" };
  }

  const proposalIds: string[] = [];
  for (const proposal of options.extraction.proposals) {
    const created = await options.convex.mutation(api.agentMemories.proposeAgentMemory, {
      type: proposal.type,
      content: proposal.content,
      summary: proposal.summary,
      source: "auto_extracted",
      reason: proposal.reason,
      evidenceText: proposal.evidenceText,
      confidence: proposal.confidence,
    });
    proposalIds.push(String(created.id));
  }

  options.trace?.mark("memory_extraction_completed", {
    proposalIds,
    proposalCount: proposalIds.length,
    rejectedCount: options.extraction.rejected.length,
  });

  return { proposalIds, skipped: false };
}

function extractSignal(text: string): { content: string; explicit: boolean } | null {
  for (const pattern of EXPLICIT_MEMORY_PATTERNS) {
    const match = pattern.exec(text);
    const content = match?.[1]?.trim();
    if (content) {
      return { content: normalizeContent(content), explicit: true };
    }
  }
  return null;
}

function buildCandidate(options: {
  userId: string;
  conversationId?: string;
  currentDocument?: CurrentDocumentContext | null;
  signal: { content: string; explicit: boolean };
  evidenceText: string;
  sensitive: boolean;
}): ExtractedMemoryCandidate {
  const scope = inferScope(options);
  const content = truncate(options.signal.content, MAX_CONTENT_LENGTH);
  const negativePreference = /不要|别|禁止|不能/.test(options.evidenceText);
  const type = inferBusinessMemoryType(options.signal.content, options.evidenceText);

  return {
    type,
    kind: negativePreference || options.signal.explicit ? "instruction" : "semantic",
    category: defaultCategoryForBusinessType(type, negativePreference),
    scopeLevel: scope.level,
    scopeKey: scope.key,
    content,
    summary: content,
    evidenceText: truncate(options.evidenceText, MAX_EVIDENCE_LENGTH),
    confidence: options.signal.explicit ? 0.86 : 0.68,
    importance: scope.level === "user" ? 0.75 : 0.65,
    reason: "Auto-extracted from an explicit user memory signal; pending user confirmation before activation.",
    privacy: options.sensitive ? "sensitive" : "normal",
  };
}

function inferBusinessMemoryType(content: string, evidenceText: string): ExtractedMemoryType {
  const text = `${content}\n${evidenceText}`;
  if (PREFERENCE_PATTERN.test(text)) return "preference";
  if (DECISION_PATTERN.test(text)) return "episodic";
  if (PROJECT_RULE_PATTERN.test(text)) return "project";
  return "preference";
}

function defaultCategoryForBusinessType(type: ExtractedMemoryType, negativePreference: boolean): string {
  if (type === "project") return "project_rule";
  if (type === "episodic") return "recent_decision";
  return negativePreference ? "negative_preference" : "user_preference";
}

function inferScope(options: {
  userId: string;
  conversationId?: string;
  currentDocument?: CurrentDocumentContext | null;
}): { level: ExtractedMemoryScopeLevel; key: string } {
  if (options.currentDocument?.id) {
    return { level: "document", key: options.currentDocument.id };
  }
  return { level: "user", key: options.userId };
}

function dedupeCandidates(candidates: ExtractedMemoryCandidate[]): ExtractedMemoryCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.scopeLevel}:${candidate.scopeKey}:${candidate.kind}:${candidate.content.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stringifyMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeContent(value: string): string {
  return value.replace(/[。.!！]+$/u, "").trim();
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
