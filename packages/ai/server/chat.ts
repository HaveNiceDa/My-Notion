import OpenAI from "openai";
import { DASHSCOPE_BASE_URL } from "../config";
import { getToolDefinitions, getToolByName } from "../tools";
import type {
  AIStreamCallback,
  ChatMessage,
  ChatOptions,
  ToolCallResult,
} from "./types";

type StreamChatStage =
  | "request_prepared"
  | "model_request_started"
  | "first_event_received"
  | "tool_execution_started"
  | "tool_execution_finished"
  | "turn_completed"
  | "stream_completed";

type StreamChatControl = {
  firstEventTimeoutMs?: number;
  onStage?: (stage: StreamChatStage, details?: Record<string, unknown>) => void;
};

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_API_KEY is not configured");
  }
  return new OpenAI({
    apiKey,
    baseURL: DASHSCOPE_BASE_URL,
  });
}

export async function streamChat(
  messages: ChatMessage[],
  options: ChatOptions,
  onEvent: AIStreamCallback,
  control?: StreamChatControl,
): Promise<void> {
  const openai = getOpenAIClient();
  const tools = getToolDefinitions();
  const firstEventTimeoutMs = control?.firstEventTimeoutMs ?? 20_000;

  const requestParams: OpenAI.ChatCompletionCreateParamsStreaming = {
    model: options.model,
    messages: messages as OpenAI.ChatCompletionMessageParam[],
    tools: tools.length > 0 ? tools : undefined,
    stream: true,
  };

  if (options.enableThinking) {
    (requestParams as unknown as Record<string, unknown>).extra_body = {
      enable_thinking: true,
      thinking_budget: options.thinkingBudget ?? 50,
    };
  }

  try {
    let currentMessages = [...messages];
    let toolCallHandled = false;
    control?.onStage?.("request_prepared", {
      model: options.model,
      messageCount: messages.length,
      enableThinking: Boolean(options.enableThinking),
      firstEventTimeoutMs,
    });

    while (!toolCallHandled) {
      control?.onStage?.("model_request_started", {
        messageCount: currentMessages.length,
      });

      const abortController = new AbortController();
      let didReceiveFirstEvent = false;
      let didTimeoutBeforeFirstEvent = false;
      const firstEventTimer = setTimeout(() => {
        if (!didReceiveFirstEvent) {
          didTimeoutBeforeFirstEvent = true;
          abortController.abort();
        }
      }, firstEventTimeoutMs);

      const response = await openai.chat.completions.create(
        requestParams,
        { signal: abortController.signal },
      );

      let hasToolCalls = false;
      let assistantMessage: Record<string, unknown> = { role: "assistant", content: "" };

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta;

        if (!didReceiveFirstEvent && delta) {
          didReceiveFirstEvent = true;
          clearTimeout(firstEventTimer);
          control?.onStage?.("first_event_received", {
            hasContent: Boolean(delta.content),
            hasReasoning: Boolean(
              options.enableThinking
                ? (delta as Record<string, unknown>)?.reasoning_content
                : undefined,
            ),
            hasToolCalls: Boolean(delta.tool_calls?.length),
          });
        }

        if (delta?.tool_calls) {
          hasToolCalls = true;
          const toolCalls = (assistantMessage.tool_calls || []) as Record<string, unknown>[];
          assistantMessage.tool_calls = toolCalls;

          delta.tool_calls.forEach((toolCall, index: number) => {
            if (!toolCalls[index]) {
              toolCalls[index] = { ...toolCall };
            } else {
              const fn = toolCall.function;
              if (fn?.arguments) {
                const existing = toolCalls[index].function as Record<string, unknown>;
                existing.arguments = (existing.arguments || "") + fn.arguments;
              }
            }
          });

          onEvent({
            type: "tool_call_start",
            tool_calls: delta.tool_calls,
          });
        }

        const reasoningContent = options.enableThinking
          ? (delta as Record<string, unknown>)?.reasoning_content as string | undefined
          : undefined;
        if (reasoningContent) {
          onEvent({ type: "reasoning", text: reasoningContent });
        }

        const text = delta?.content;
        if (text) {
          assistantMessage.content = ((assistantMessage.content as string) || "") + text;
          onEvent({ type: "content", text });
        }
      }

      clearTimeout(firstEventTimer);

      if (didTimeoutBeforeFirstEvent) {
        throw new Error(
          `AI upstream first event timeout after ${firstEventTimeoutMs}ms`,
        );
      }

      if (!hasToolCalls) {
        control?.onStage?.("turn_completed", { hasToolCalls: false });
        toolCallHandled = true;
        break;
      }

      currentMessages.push(assistantMessage as unknown as ChatMessage);

      for (const toolCall of (assistantMessage.tool_calls || []) as ToolCallResult[]) {
        const toolName = toolCall.function.name;
        let toolArgs: Record<string, unknown>;

        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          toolArgs = {};
        }

        control?.onStage?.("tool_execution_started", { toolName });
        onEvent({
          type: "tool_executing",
          tool_name: toolName,
          tool_args: toolArgs,
        });

        let toolResult: string;
        try {
          const tool = getToolByName(toolName);
          if (tool) {
            const result = await tool.execute(toolArgs);
            toolResult =
              typeof result === "string" ? result : JSON.stringify(result);
          } else {
            toolResult = `Tool ${toolName} not found`;
          }
        } catch (error) {
          console.error(`[streamChat] Error executing tool ${toolName}:`, error);
          toolResult = `Error executing tool ${toolName}: ${error}`;
        }

        control?.onStage?.("tool_execution_finished", {
          toolName,
          resultLength: toolResult.length,
        });

        onEvent({ type: "tool_result", tool_name: toolName, result: toolResult });

        currentMessages.push({
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      requestParams.messages = currentMessages as OpenAI.ChatCompletionMessageParam[];
      control?.onStage?.("turn_completed", { hasToolCalls: true });
    }

    control?.onStage?.("stream_completed");
    onEvent({ type: "done" });
  } catch (error) {
    onEvent({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
