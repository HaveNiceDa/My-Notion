import type { RecoverableToolError, ToolContext } from "./types";
import { buildToolMetadata } from "./result-contract";

type ToolExecutor = (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;

interface ToolFallbackOptions {
  name: string;
  execute: ToolExecutor;
}

// 给所有 tool 加一层统一异常边界：tool 失败时把错误变成 LLM 可继续推理的结构化结果。
export function withToolFallback({ name, execute }: ToolFallbackOptions): ToolExecutor {
  return async (args, context) => {
    try {
      return await execute(args, context);
    } catch (error) {
      return buildRecoverableToolError(name, error, "execution_error");
    }
  };
}

export function buildRecoverableToolError(
  toolName: string,
  error: unknown,
  reason: RecoverableToolError["metadata"]["reason"] = "execution_error",
): RecoverableToolError {
  const message = error instanceof Error ? error.message : String(error);
  return {
    error: message,
    summary: `${toolName} failed: ${message}`,
    recoverable: true,
    sources: [],
    metadata: {
      ...buildToolMetadata(toolName),
      reason,
    },
  };
}
