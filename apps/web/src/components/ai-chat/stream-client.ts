import { devLog } from "@notion/business/utils";
import type { AgentRunMode, AgentStreamEvent } from "./types";
import type { AIModelId } from "./models";
import type { CurrentDocumentContext } from "@/src/lib/store/use-current-document-store";

export interface AgentStreamCallbacks {
  onChunk: (chunk: string) => void;
  onReasoningChunk: (chunk: string) => void;
  onToolCallStart: (toolCallId: string, toolName: string) => void;
  onToolCallDelta: (toolCallId: string, delta: string) => void;
  onToolResultDelta: (toolCallId: string, delta: string) => void;
  onToolCallResult: (toolCallId: string, result: unknown) => void;
  onComplete: () => Promise<void>;
  onError: (error: unknown) => void;
  onRetry?: (attempt: number, error: unknown) => void;
}

export interface AgentStreamOptions {
  messages: unknown[];
  model: AIModelId;
  conversationId: string;
  enableThinking: boolean;
  currentDocument: CurrentDocumentContext | null;
  mode?: AgentRunMode;
  callbacks: AgentStreamCallbacks;
  maxRetries?: number;
}

const DEFAULT_STREAM_MAX_RETRIES = 1;
const RETRYABLE_STATUS_CODES = new Set([408, 500, 502, 503, 504]);

/**
 * Agent 流式客户端
 * 向 /api/agent/stream 发起 NDJSON 流式请求，解析事件并分发到回调
 * 事件类型：text-delta / reasoning-delta / tool-call-start / tool-call-delta / tool-result-delta / tool-call-result / finish / error
 */
export async function runAgentStream(options: AgentStreamOptions) {
  const { callbacks } = options;
  const maxRetries = options.maxRetries ?? DEFAULT_STREAM_MAX_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchAgentStream(options);
      await readAgentStreamResponse(response, callbacks);
      return;
    } catch (error) {
      if (!shouldRetryStream(error, attempt, maxRetries)) {
        callbacks.onError(error);
        return;
      }
      callbacks.onRetry?.(attempt + 1, error);
    }
  }
}

async function fetchAgentStream(options: AgentStreamOptions): Promise<Response> {
  try {
    return await fetch("/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: options.messages,
        modelId: options.model,
        conversationId: options.conversationId,
        enableThinking: options.enableThinking,
        currentDocument: options.currentDocument,
        mode: options.mode,
      }),
    });
  } catch (error) {
    throw new AgentStreamRetryableError(error);
  }
}

async function readAgentStreamResponse(
  response: Response,
  callbacks: AgentStreamCallbacks,
): Promise<boolean> {
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
      throw new Error(`请求过于频繁，请 ${seconds} 秒后再试`);
    }
    throw new AgentStreamHttpError(response.status, `Agent stream failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let streamFailed = false;
  let processedAnyEvent = false;

  function handleEvent(event: AgentStreamEvent) {
    processedAnyEvent = true;
    switch (event.type) {
      case "text-delta":
        callbacks.onChunk(event.delta);
        break;
      case "reasoning-delta":
        callbacks.onReasoningChunk(event.delta);
        break;
      case "tool-call-start":
        callbacks.onToolCallStart(event.toolCallId, event.toolName);
        break;
      case "tool-call-delta":
        callbacks.onToolCallDelta(event.toolCallId, event.delta);
        break;
      case "tool-result-delta":
        callbacks.onToolResultDelta(event.toolCallId, event.delta);
        break;
      case "tool-call-result":
        callbacks.onToolCallResult(event.toolCallId, event.result);
        break;
      case "error":
        streamFailed = true;
        callbacks.onError(new Error(event.message));
        break;
      case "finish":
        devLog("[Agent] 接收到结束事件");
        break;
    }
  }

  function processBuffer(isFinal: boolean = false) {
    const lines = buffer.split("\n");
    const endIdx = isFinal ? lines.length : lines.length - 1;

    for (let i = 0; i < endIdx; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        handleEvent(JSON.parse(line) as AgentStreamEvent);
      } catch (error) {
        console.error("[Agent] 解析流式事件出错:", error);
      }
    }
    buffer = isFinal ? "" : lines[lines.length - 1];
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) processBuffer(true);
        if (!streamFailed) {
          await callbacks.onComplete();
        }
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      processBuffer(false);
    }
  } catch (error) {
    if (processedAnyEvent) {
      throw error;
    }
    throw new AgentStreamRetryableError(error);
  } finally {
    reader.releaseLock();
  }

  return processedAnyEvent;
}

function shouldRetryStream(error: unknown, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  if (error instanceof AgentStreamRetryableError) return true;
  if (error instanceof AgentStreamHttpError) return RETRYABLE_STATUS_CODES.has(error.status);
  return false;
}

class AgentStreamHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "AgentStreamHttpError";
  }
}

class AgentStreamRetryableError extends Error {
  constructor(public readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "AgentStreamRetryableError";
  }
}
