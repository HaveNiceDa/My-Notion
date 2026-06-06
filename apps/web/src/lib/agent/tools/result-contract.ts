export const TOOL_RESULT_CONTRACT_VERSION = "tool-result-v1";

export type ToolResultErrorReason = "validation_error" | "execution_error" | "unavailable";

export interface ToolResultMetadata {
  toolName: string;
  contractVersion: typeof TOOL_RESULT_CONTRACT_VERSION;
  reason?: ToolResultErrorReason;
  [key: string]: unknown;
}

export interface DocumentToolResultSource {
  type: "document";
  documentId: string;
  title?: string;
  score?: number;
  path?: string[];
}

export interface WebToolResultSource {
  type: "web";
  url: string;
  title?: string;
  snippet?: string;
}

export interface MemoryToolResultSource {
  type: "memory";
  memoryId: string;
  memoryType?: string;
  score?: number;
}

export type ToolResultSource =
  | DocumentToolResultSource
  | WebToolResultSource
  | MemoryToolResultSource;

export interface ToolResultContractOptions {
  summary: string;
  sources?: ToolResultSource[];
  recoverable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ToolErrorResultOptions {
  summary?: string;
  reason?: ToolResultErrorReason;
  sources?: ToolResultSource[];
  metadata?: Record<string, unknown>;
}

// Tool 结果契约基建：统一补齐 summary/sources/metadata/recoverable，同时保留各 tool 的业务字段。
export function buildToolMetadata(
  toolName: string,
  extra: Record<string, unknown> = {},
): ToolResultMetadata {
  return {
    toolName,
    contractVersion: TOOL_RESULT_CONTRACT_VERSION,
    ...extra,
  };
}

export function mergeToolMetadata(
  toolName: string,
  existing: unknown,
  extra: Record<string, unknown> = {},
): ToolResultMetadata {
  return {
    ...(isRecord(existing) ? existing : {}),
    ...buildToolMetadata(toolName, extra),
  };
}

export function withToolResultContract<T extends Record<string, unknown>>(
  toolName: string,
  result: T,
  options: ToolResultContractOptions,
): T & {
  summary: string;
  sources: ToolResultSource[];
  recoverable: boolean;
  metadata: ToolResultMetadata;
} {
  return {
    ...result,
    summary: options.summary,
    sources: options.sources ?? [],
    recoverable: options.recoverable ?? true,
    metadata: mergeToolMetadata(toolName, result.metadata, options.metadata),
  };
}

export function buildToolErrorResult(
  toolName: string,
  error: unknown,
  options: ToolErrorResultOptions = {},
) {
  const message = error instanceof Error ? error.message : String(error);
  const reason = options.reason ?? "execution_error";
  return withToolResultContract(
    toolName,
    { error: message },
    {
      summary: options.summary ?? `${toolName} failed: ${message}`,
      sources: options.sources,
      recoverable: true,
      metadata: {
        ...options.metadata,
        reason,
      },
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
