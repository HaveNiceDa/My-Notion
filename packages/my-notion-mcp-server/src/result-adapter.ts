type AgentToolResultLike = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

export function toMcpToolResult(result: AgentToolResultLike) {
  return {
    content: result.content,
    structuredContent: result.structuredContent,
    isError: result.isError,
  };
}
