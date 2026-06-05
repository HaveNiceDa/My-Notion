export const TOOL_RESULT_CONTRACT_VERSION = "tool-result-v1";

export type ToolResultErrorReason = "validation_error" | "execution_error" | "unavailable";

export interface ToolResultMetadata {
  toolName: string;
  contractVersion: typeof TOOL_RESULT_CONTRACT_VERSION;
  reason?: ToolResultErrorReason;
  [key: string]: unknown;
}

// Tool 结果契约的轻量基建：先统一 metadata，不强制重塑各业务 result，避免破坏现有 UI。
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
