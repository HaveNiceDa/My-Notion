export type AgentTraceEventType =
  | "run_start"
  | "run_end"
  | "run_error"
  | "react_iteration_start"
  | "react_iteration_end"
  | "llm_start"
  | "llm_first_chunk"
  | "llm_end"
  | "llm_error"
  | "tool_start"
  | "tool_end"
  | "tool_error"
  | "tool_unknown"
  | "memory_injected"
  | "memory_search"
  | "memory_proposed"
  | "memory_committed"
  | "memory_extraction_skipped"
  | "memory_extraction_completed";

export interface AgentTraceEvent {
  traceId: string;
  type: AgentTraceEventType;
  timestamp: number;
  elapsedMs: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentTracerOptions {
  traceId?: string;
  baseMetadata?: Record<string, unknown>;
  sink?: (event: AgentTraceEvent) => void;
}

const MAX_SUMMARY_LENGTH = 800;
const REDACTED_KEYS = new Set(["content", "messages", "apikey", "token", "authorization"]);

/**
 * Agent 观测性轻量封装：先输出结构化本地日志，后续可把 sink 替换为 Sentry/Harness 写入。
 */
export class AgentTracer {
  readonly traceId: string;
  private readonly startedAt: number;
  private readonly sink: (event: AgentTraceEvent) => void;
  private readonly baseMetadata: Record<string, unknown>;

  constructor(options: AgentTracerOptions = {}) {
    this.traceId = options.traceId ?? createTraceId();
    this.startedAt = nowMs();
    this.baseMetadata = options.baseMetadata ?? {};
    this.sink = options.sink ?? defaultTraceSink;
  }

  mark(type: AgentTraceEventType, metadata?: Record<string, unknown>): AgentTraceEvent {
    const event: AgentTraceEvent = {
      traceId: this.traceId,
      type,
      timestamp: Date.now(),
      elapsedMs: Math.round(nowMs() - this.startedAt),
      metadata: compactMetadata({ ...this.baseMetadata, ...metadata }),
    };
    this.sink(event);
    return event;
  }

  time(type: AgentTraceEventType, metadata?: Record<string, unknown>) {
    const startedAt = nowMs();
    return (extraMetadata?: Record<string, unknown>) =>
      this.mark(type, {
        ...metadata,
        ...extraMetadata,
        durationMs: Math.round(nowMs() - startedAt),
      });
  }

  event(
    type: AgentTraceEventType,
    durationMs: number,
    metadata?: Record<string, unknown>,
  ): AgentTraceEvent {
    const event: AgentTraceEvent = {
      traceId: this.traceId,
      type,
      timestamp: Date.now(),
      elapsedMs: Math.round(nowMs() - this.startedAt),
      durationMs: Math.round(durationMs),
      metadata: compactMetadata({ ...this.baseMetadata, ...metadata }),
    };
    this.sink(event);
    return event;
  }
}

export function createTraceId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function summarizeForTrace(value: unknown): string {
  return truncate(JSON.stringify(redactValue(value)) ?? "");
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function defaultTraceSink(event: AgentTraceEvent) {
  if (!isAgentTraceLogEnabled()) return;
  console.info("[AgentTrace]", JSON.stringify(event));
}

function isAgentTraceLogEnabled(): boolean {
  return process.env.AGENT_TRACE_LOG === "1" || process.env.AGENT_TRACE_LOG === "true";
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function compactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, nestedValue]) => [
      key,
      REDACTED_KEYS.has(key.toLowerCase()) ? "[redacted]" : redactValue(nestedValue),
    ]),
  );
}

function truncate(value: string): string {
  return value.length > MAX_SUMMARY_LENGTH
    ? `${value.slice(0, MAX_SUMMARY_LENGTH)}...`
    : value;
}
