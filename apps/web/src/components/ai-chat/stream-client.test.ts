import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentStream } from "./stream-client";
import type { AgentStreamCallbacks } from "./stream-client";

vi.mock("@notion/business/utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@notion/business/utils")>();
  return {
    ...original,
    devLog: vi.fn(),
  };
});

function createCallbacks(): AgentStreamCallbacks {
  return {
    onChunk: vi.fn(),
    onReasoningChunk: vi.fn(),
    onToolCallStart: vi.fn(),
    onToolCallDelta: vi.fn(),
    onToolResultDelta: vi.fn(),
    onToolCallResult: vi.fn(),
    onComplete: vi.fn().mockResolvedValue(undefined),
    onError: vi.fn(),
  };
}

function createStreamResponse(chunks: string[], init: ResponseInit = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
    ...init,
  });
}

describe("runAgentStream", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("发送标准请求体并分发文本、推理、工具和完成事件", async () => {
    const callbacks = createCallbacks();
    const fetchMock = vi.fn().mockResolvedValue(createStreamResponse([
      JSON.stringify({ type: "text-delta", id: "msg", delta: "你好" }) + "\n",
      JSON.stringify({ type: "reasoning-delta", id: "msg", delta: "思考" }) + "\n",
      JSON.stringify({ type: "tool-call-start", toolCallId: "tool-1", toolName: "knowledge_search" }) + "\n",
      JSON.stringify({ type: "tool-call-delta", toolCallId: "tool-1", delta: "{\"query\":" }) + "\n",
      JSON.stringify({ type: "tool-result-delta", toolCallId: "tool-1", delta: "检索中" }) + "\n",
      JSON.stringify({ type: "tool-call-result", toolCallId: "tool-1", result: { ok: true } }) + "\n",
      JSON.stringify({ type: "finish", model: "deepseek-v4-pro", usage: null }) + "\n",
    ]));
    vi.stubGlobal("fetch", fetchMock);

    await runAgentStream({
      messages: [{ role: "user", content: "你好" }],
      model: "deepseek-v4-pro",
      conversationId: "conv-1",
      enableThinking: true,
      currentDocument: null,
      callbacks,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "你好" }],
        modelId: "deepseek-v4-pro",
        conversationId: "conv-1",
        enableThinking: true,
        currentDocument: null,
      }),
    });
    expect(callbacks.onChunk).toHaveBeenCalledWith("你好");
    expect(callbacks.onReasoningChunk).toHaveBeenCalledWith("思考");
    expect(callbacks.onToolCallStart).toHaveBeenCalledWith("tool-1", "knowledge_search");
    expect(callbacks.onToolCallDelta).toHaveBeenCalledWith("tool-1", "{\"query\":");
    expect(callbacks.onToolResultDelta).toHaveBeenCalledWith("tool-1", "检索中");
    expect(callbacks.onToolCallResult).toHaveBeenCalledWith("tool-1", { ok: true });
    expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("支持跨 chunk 拆分的 NDJSON 行", async () => {
    const callbacks = createCallbacks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createStreamResponse([
      "{\"type\":\"text-delta\",\"id\":\"msg\",",
      "\"delta\":\"拆分\"}\n",
      "{\"type\":\"finish\",\"model\":\"deepseek-v4-pro\",\"usage\":null}\n",
    ])));

    await runAgentStream({
      messages: [],
      model: "deepseek-v4-pro",
      conversationId: "conv-1",
      enableThinking: false,
      currentDocument: null,
      callbacks,
    });

    expect(callbacks.onChunk).toHaveBeenCalledWith("拆分");
    expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
  });

  it("收到 error 事件时上报错误且不触发完成回调", async () => {
    const callbacks = createCallbacks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createStreamResponse([
      JSON.stringify({ type: "error", message: "模型异常" }) + "\n",
    ])));

    await runAgentStream({
      messages: [],
      model: "deepseek-v4-pro",
      conversationId: "conv-1",
      enableThinking: true,
      currentDocument: null,
      callbacks,
    });

    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    expect(callbacks.onComplete).not.toHaveBeenCalled();
  });

  it("429 响应包含 Retry-After 时返回友好限流错误", async () => {
    const callbacks = createCallbacks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, {
      status: 429,
      statusText: "Too Many Requests",
      headers: { "Retry-After": "12" },
    })));

    await runAgentStream({
      messages: [],
      model: "deepseek-v4-pro",
      conversationId: "conv-1",
      enableThinking: true,
      currentDocument: null,
      callbacks,
    });

    expect(callbacks.onError).toHaveBeenCalledWith(expect.objectContaining({
      message: "请求过于频繁，请 12 秒后再试",
    }));
    expect(callbacks.onComplete).not.toHaveBeenCalled();
  });
});
