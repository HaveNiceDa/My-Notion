import { devLog } from "@notion/business/utils";
import type { AgentStreamEvent } from "./types";
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
}

export interface AgentStreamOptions {
  messages: unknown[];
  model: AIModelId;
  conversationId: string;
  enableThinking: boolean;
  currentDocument: CurrentDocumentContext | null;
  callbacks: AgentStreamCallbacks;
}

/**
 * Agent 流式客户端
 * 向 /api/agent/stream 发起 NDJSON 流式请求，解析事件并分发到回调
 * 事件类型：text-delta / reasoning-delta / tool-call-start / tool-call-delta / tool-result-delta / tool-call-result / finish / error
 */
export async function runAgentStream(options: AgentStreamOptions) {
  const { messages, model, conversationId, enableThinking, currentDocument, callbacks } = options;

  try {
    const response = await fetch("/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        modelId: model,
        conversationId,
        enableThinking,
        currentDocument,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
        throw new Error(`请求过于频繁，请 ${seconds} 秒后再试`);
      }
      throw new Error(`Agent stream failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let streamFailed = false;

    function handleEvent(event: AgentStreamEvent) {
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
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    callbacks.onError(error);
  }
}
