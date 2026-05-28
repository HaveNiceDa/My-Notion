import { describe, it, expect, vi } from "vitest";
import { enqueueEvent, applyThinkingParams, streamModelResponse } from "../stream";
import type { AgentStreamEvent, StreamModelOptions } from "../stream";
import { AgentTracer } from "../trace";
import type { AgentTraceEvent } from "../trace";

describe("enqueueEvent", () => {
  it("将事件编码为 NDJSON 行并写入 controller", () => {
    const chunks: Uint8Array[] = [];
    const controller = {
      enqueue: (chunk: Uint8Array) => chunks.push(chunk),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();

    const event: AgentStreamEvent = { type: "text-delta", id: "1", delta: "Hello" };
    enqueueEvent(controller, encoder, event);

    expect(chunks.length).toBe(1);
    const decoded = new TextDecoder().decode(chunks[0]);
    expect(decoded).toBe(`${JSON.stringify(event)}\n`);
  });

  it("error 事件正确编码", () => {
    const chunks: Uint8Array[] = [];
    const controller = {
      enqueue: (chunk: Uint8Array) => chunks.push(chunk),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();

    const event: AgentStreamEvent = { type: "error", message: "Something went wrong" };
    enqueueEvent(controller, encoder, event);

    const decoded = new TextDecoder().decode(chunks[0]);
    const parsed = JSON.parse(decoded.trim());
    expect(parsed.type).toBe("error");
    expect(parsed.message).toBe("Something went wrong");
  });

  it("tool-call-start 事件正确编码", () => {
    const chunks: Uint8Array[] = [];
    const controller = {
      enqueue: (chunk: Uint8Array) => chunks.push(chunk),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();

    const event: AgentStreamEvent = {
      type: "tool-call-start",
      toolCallId: "tc-1",
      toolName: "knowledge_search",
    };
    enqueueEvent(controller, encoder, event);

    const decoded = new TextDecoder().decode(chunks[0]);
    const parsed = JSON.parse(decoded.trim());
    expect(parsed.type).toBe("tool-call-start");
    expect(parsed.toolCallId).toBe("tc-1");
    expect(parsed.toolName).toBe("knowledge_search");
  });

  it("tool-call-result 事件正确编码", () => {
    const chunks: Uint8Array[] = [];
    const controller = {
      enqueue: (chunk: Uint8Array) => chunks.push(chunk),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();

    const event: AgentStreamEvent = {
      type: "tool-call-result",
      toolCallId: "tc-2",
      result: { answer: 42 },
    };
    enqueueEvent(controller, encoder, event);

    const decoded = new TextDecoder().decode(chunks[0]);
    const parsed = JSON.parse(decoded.trim());
    expect(parsed.type).toBe("tool-call-result");
    expect(parsed.result).toEqual({ answer: 42 });
  });

  it("finish 事件正确编码", () => {
    const chunks: Uint8Array[] = [];
    const controller = {
      enqueue: (chunk: Uint8Array) => chunks.push(chunk),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();

    const event: AgentStreamEvent = { type: "finish", model: "test-model", usage: null };
    enqueueEvent(controller, encoder, event);

    const decoded = new TextDecoder().decode(chunks[0]);
    const parsed = JSON.parse(decoded.trim());
    expect(parsed.type).toBe("finish");
    expect(parsed.model).toBe("test-model");
  });
});

describe("applyThinkingParams", () => {
  it("enableThinking=true 时注入 enable_thinking 和 thinking_budget", () => {
    const params: Record<string, unknown> = { model: "test" };
    applyThinkingParams(params, true);
    expect(params.enable_thinking).toBe(true);
    expect(params.thinking_budget).toBe(200);
  });

  it("enableThinking=false 时不注入任何参数", () => {
    const params: Record<string, unknown> = { model: "test" };
    applyThinkingParams(params, false);
    expect(params.enable_thinking).toBeUndefined();
    expect(params.thinking_budget).toBeUndefined();
  });

  it("不覆盖已有参数", () => {
    const params: Record<string, unknown> = { model: "test", stream: true };
    applyThinkingParams(params, true);
    expect(params.model).toBe("test");
    expect(params.stream).toBe(true);
    expect(params.enable_thinking).toBe(true);
  });
});

describe("streamModelResponse", () => {
  function createMockStream(chunks: object[]) {
    return {
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          async next() {
            if (i >= chunks.length) return { done: true, value: undefined };
            return { done: false, value: chunks[i++] };
          },
        };
      },
    };
  }

  function createMockOpenAI(streamChunks: object[]) {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(createMockStream(streamChunks)),
        },
      },
    } as unknown as import("openai").default;
  }

  function createController() {
    const chunks: Uint8Array[] = [];
    return {
      controller: {
        enqueue: (chunk: Uint8Array) => chunks.push(chunk),
      } as unknown as ReadableStreamDefaultController<Uint8Array>,
      chunks,
    };
  }

  it("纯文本响应：输出 text-delta 事件，返回空 tool_calls", async () => {
    const mockOpenAI = createMockOpenAI([
      { choices: [{ delta: { content: "Hello" } }] },
      { choices: [{ delta: { content: " world" } }] },
    ]);
    const { controller, chunks } = createController();
    const encoder = new TextEncoder();

    const result = await streamModelResponse({
      openai: mockOpenAI,
      params: { model: "test", messages: [], stream: true } as any,
      controller,
      encoder,
      responseId: "resp-1",
      enableThinking: false,
    });

    expect(result).toEqual([]);
    expect(chunks.length).toBe(2);
    const text1 = JSON.parse(new TextDecoder().decode(chunks[0]).trim());
    expect(text1.type).toBe("text-delta");
    expect(text1.delta).toBe("Hello");
    const text2 = JSON.parse(new TextDecoder().decode(chunks[1]).trim());
    expect(text2.delta).toBe(" world");
  });

  it("记录 LLM trace 事件和首 chunk 延迟", async () => {
    const mockOpenAI = createMockOpenAI([
      { choices: [{ delta: { content: "Hello" } }] },
    ]);
    const { controller } = createController();
    const encoder = new TextEncoder();
    const events: AgentTraceEvent[] = [];
    const trace = new AgentTracer({
      traceId: "trace-stream",
      sink: (event) => events.push(event),
    });

    await streamModelResponse({
      openai: mockOpenAI,
      params: { model: "test", messages: [], stream: true } as any,
      controller,
      encoder,
      responseId: "resp-trace",
      enableThinking: false,
      trace,
      iteration: 1,
    });

    expect(events.map((event) => event.type)).toEqual([
      "llm_start",
      "llm_first_chunk",
      "llm_end",
    ]);
    expect(events[2].metadata).toMatchObject({
      iteration: 1,
      textDeltaCount: 1,
      toolCallCount: 0,
    });
  });

  it("thinking 模式：输出 reasoning-delta 事件", async () => {
    const mockOpenAI = createMockOpenAI([
      { choices: [{ delta: { reasoning_content: "思考中...", content: null } }] },
      { choices: [{ delta: { content: "答案" } }] },
    ]);
    const { controller, chunks } = createController();
    const encoder = new TextEncoder();

    const result = await streamModelResponse({
      openai: mockOpenAI,
      params: { model: "test", messages: [], stream: true } as any,
      controller,
      encoder,
      responseId: "resp-2",
      enableThinking: true,
    });

    expect(result).toEqual([]);
    const reasoning = JSON.parse(new TextDecoder().decode(chunks[0]).trim());
    expect(reasoning.type).toBe("reasoning-delta");
    expect(reasoning.delta).toBe("思考中...");
    const text = JSON.parse(new TextDecoder().decode(chunks[1]).trim());
    expect(text.type).toBe("text-delta");
  });

  it("tool_calls 响应：累积并返回 tool_calls", async () => {
    const mockOpenAI = createMockOpenAI([
      {
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: "call-1",
              function: { name: "web_search", arguments: "" },
            }],
          },
        }],
      },
      {
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              function: { arguments: '{"qu' },
            }],
          },
        }],
      },
      {
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              function: { arguments: 'ery":"test"}' },
            }],
          },
        }],
      },
    ]);
    const { controller, chunks } = createController();
    const encoder = new TextEncoder();

    const result = await streamModelResponse({
      openai: mockOpenAI,
      params: { model: "test", messages: [], stream: true } as any,
      controller,
      encoder,
      responseId: "resp-3",
      enableThinking: false,
    });

    expect(result.length).toBe(1);
    expect(result[0].id).toBe("call-1");
    expect(result[0].function.name).toBe("web_search");
    expect(result[0].function.arguments).toBe('{"query":"test"}');

    const startEvent = JSON.parse(new TextDecoder().decode(chunks[0]).trim());
    expect(startEvent.type).toBe("tool-call-start");
    expect(startEvent.toolName).toBe("web_search");
  });

  it("超时后终止请求", async () => {
    const abortSpy = vi.fn();
    const mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockImplementation((_params: any, options: any) => {
            options.signal.addEventListener("abort", abortSpy);
            return new Promise(() => {});
          }),
        },
      },
    } as unknown as import("openai").default;
    const { controller } = createController();
    const encoder = new TextEncoder();

    const promise = streamModelResponse({
      openai: mockOpenAI,
      params: { model: "test", messages: [], stream: true } as any,
      controller,
      encoder,
      responseId: "resp-timeout",
      enableThinking: false,
      timeoutMs: 50,
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(abortSpy).toHaveBeenCalled();
  });
});
