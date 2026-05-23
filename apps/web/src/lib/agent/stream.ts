import OpenAI from "openai";

// Agent 流式事件协议：前端通过 NDJSON 解析这些事件
export type AgentStreamEvent =
  | { type: "text-delta"; id: string; delta: string }
  | { type: "reasoning-delta"; id: string; delta: string }
  | { type: "tool-call-start"; toolCallId: string; toolName: string }
  | { type: "tool-call-delta"; toolCallId: string; delta: string }
  | { type: "tool-call-result"; toolCallId: string; result: unknown }
  | { type: "finish"; model: string; usage: null }
  | { type: "error"; message: string };

// 向流中写入一个 NDJSON 事件
export function enqueueEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: AgentStreamEvent,
): void {
  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

// 构建深度思考参数，作为顶层属性合并到 createParams
// 注意：Node.js SDK 中 enable_thinking 和 thinking_budget 必须作为顶层参数传递，
// 不能放在 extra_body 中（那是 Python SDK 的做法）
export function applyThinkingParams(
  params: Record<string, unknown>,
  enableThinking: boolean,
): void {
  if (!enableThinking) return;
  params.enable_thinking = true;
  // thinking_budget: 思考阶段最大 token 数（Qwen3+ 模型支持，DeepSeek 等可能忽略）
  params.thinking_budget = 200;
}

// 流式调用 LLM 并输出事件，返回 LLM 产生的 function tool_calls（如有）
// timeoutMs: 流式响应超时（毫秒），超时后终止请求
export async function streamModelResponse(
  openai: OpenAI,
  params: OpenAI.ChatCompletionCreateParamsStreaming,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  responseId: string,
  enableThinking: boolean,
  timeoutMs: number = 120_000,
): Promise<OpenAI.ChatCompletionMessageFunctionToolCall[]> {
  const pendingToolCalls: Record<number, OpenAI.ChatCompletionMessageFunctionToolCall> = {};
  const startedToolCallIds = new Set<string>();

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[Stream] 响应超时 (${timeoutMs}ms)，终止请求`);
    abortController.abort();
  }, timeoutMs);

  const response = await openai.chat.completions.create(params, {
    signal: abortController.signal,
  });

  try {
    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // DashScope 思考模式通过 reasoning_content 字段返回推理过程
      const reasoning = enableThinking
        ? ((delta as Record<string, unknown>).reasoning_content as string | undefined)
        : undefined;
      if (reasoning) {
        enqueueEvent(controller, encoder, {
          type: "reasoning-delta",
          id: responseId,
          delta: reasoning,
        });
      }

      if (delta.content) {
        enqueueEvent(controller, encoder, {
          type: "text-delta",
          id: responseId,
          delta: delta.content,
        });
      }

      // 累积 tool_call deltas，DashScope 可能分多次返回一个 tool_call 的参数
      for (const toolCallDelta of delta.tool_calls ?? []) {
        const index = toolCallDelta.index ?? 0;
        const existing = pendingToolCalls[index] ?? {
          id: toolCallDelta.id ?? `tool-${index}`,
          type: "function" as const,
          function: { name: "", arguments: "" },
        };

        if (toolCallDelta.id) existing.id = toolCallDelta.id;
        if (toolCallDelta.function?.name) existing.function.name = toolCallDelta.function.name;
        if (toolCallDelta.function?.arguments) {
          existing.function.arguments += toolCallDelta.function.arguments;
        }
        pendingToolCalls[index] = existing;

        // 首次收到 tool name 时发送 tool-call-start 事件
        if (existing.function.name && !startedToolCallIds.has(existing.id)) {
          startedToolCallIds.add(existing.id);
          enqueueEvent(controller, encoder, {
            type: "tool-call-start",
            toolCallId: existing.id,
            toolName: existing.function.name,
          });
        }

        if (toolCallDelta.function?.arguments) {
          enqueueEvent(controller, encoder, {
            type: "tool-call-delta",
            toolCallId: existing.id,
            delta: toolCallDelta.function.arguments,
          });
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return Object.values(pendingToolCalls);
}
