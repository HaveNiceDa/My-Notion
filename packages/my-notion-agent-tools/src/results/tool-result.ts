import { MyNotionApiError } from "../client/http-client.js";
import type { AgentToolResult } from "../types.js";

export function toToolResult(
  data: Record<string, unknown>,
  message?: string,
): AgentToolResult {
  return {
    structuredContent: data,
    // 兼容只展示 text content 的客户端，保留可读说明和 JSON 兜底。
    content: [
      {
        type: "text",
        text: [message, JSON.stringify(data, null, 2)].filter(Boolean).join("\n\n"),
      },
    ],
  };
}

export function toErrorToolResult(error: unknown, action: string): AgentToolResult {
  const apiError = error instanceof MyNotionApiError ? error : null;
  const message = error instanceof Error ? error.message : String(error);
  const structured = {
    action,
    error: {
      message,
      name: error instanceof Error ? error.name : "Error",
      status: apiError?.status,
      code: apiError?.code,
      requestId: apiError?.requestId,
    },
  };

  return {
    isError: true,
    structuredContent: structured,
    content: [
      {
        type: "text",
        text: [
          `My-Notion tool failed during ${action}.`,
          apiError?.code ? `Error code: ${apiError.code}` : undefined,
          apiError?.requestId ? `Request ID: ${apiError.requestId}` : undefined,
          `Message: ${message}`,
          JSON.stringify(structured, null, 2),
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  };
}
