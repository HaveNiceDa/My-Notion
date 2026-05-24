import type OpenAI from "openai";

export type ToolDefinition = {
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
};

export type ToolDefinitions = Record<string, ToolDefinition>;

export function toolDefinitionsToOpenAITools(toolDefinitions: ToolDefinitions) {
  return Object.entries(toolDefinitions).map(([name, definition]) => ({
    type: "function" as const,
    function: {
      name,
      description: definition.description || "",
      parameters: definition.inputSchema,
    },
  }));
}

function extractTextContent(msg: Record<string, unknown>): string {
  const parts = msg.parts as
    | Array<{ type: string; text?: string }>
    | undefined;
  if (parts && Array.isArray(parts)) {
    return parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .join("\n");
  }
  return (msg.content as string) || "";
}

export function convertToOpenAIMessages(
  messages: Array<Record<string, unknown>>,
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    const role = msg.role as string;

    if (role === "user") {
      const parts = msg.parts as
        | Array<{ type: string; text?: string }>
        | undefined;
      if (parts && Array.isArray(parts)) {
        const text = parts
          .filter((p) => p.type === "text" && p.text)
          .map((p) => p.text!)
          .join("\n");
        result.push({ role: "user", content: text });
      } else {
        result.push({
          role: "user",
          content: (msg.content as string) || "",
        });
      }
    } else if (role === "assistant") {
      const toolInvocations = msg.toolInvocations as
        | Array<{
            toolCallId: string;
            toolName: string;
            args: Record<string, unknown>;
            state?: string;
            result?: unknown;
          }>
        | undefined;

      if (toolInvocations && toolInvocations.length > 0) {
        const textContent = extractTextContent(msg);
        result.push({
          role: "assistant",
          content: textContent || null,
          tool_calls: toolInvocations.map((tc) => ({
            id: tc.toolCallId,
            type: "function" as const,
            function: {
              name: tc.toolName,
              arguments:
                typeof tc.args === "string"
                  ? tc.args
                  : JSON.stringify(tc.args),
            },
          })),
        });

        for (const tc of toolInvocations) {
          if (tc.state === "result" && tc.result !== undefined) {
            result.push({
              role: "tool" as const,
              tool_call_id: tc.toolCallId,
              content:
                typeof tc.result === "string"
                  ? tc.result
                  : JSON.stringify(tc.result),
            } as OpenAI.ChatCompletionToolMessageParam);
          }
        }
      } else {
        const textContent = extractTextContent(msg);
        result.push({ role: "assistant", content: textContent || "" });
      }
    }
  }

  return result;
}
