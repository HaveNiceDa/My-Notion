import { describe, expect, it, vi } from "vitest";
import { runReActLoop } from "../react-loop";
import type { AgentTool } from "../tools/definitions";

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

function createController() {
  const chunks: Uint8Array[] = [];
  return {
    controller: {
      enqueue: (chunk: Uint8Array) => chunks.push(chunk),
    } as unknown as ReadableStreamDefaultController<Uint8Array>,
    chunks,
  };
}

describe("runReActLoop", () => {
  it("达到工具轮次上限后强制输出最终回答，并复用重复 tool 结果", async () => {
    const repeatedToolCall = {
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call-1",
            function: { name: "web_extract", arguments: '{"url":"https://example.com"}' },
          }],
        },
      }],
    };
    const finalText = { choices: [{ delta: { content: "这是最终总结。" } }] };
    const create = vi.fn()
      .mockResolvedValueOnce(createMockStream([repeatedToolCall]))
      .mockResolvedValueOnce(createMockStream([repeatedToolCall]))
      .mockResolvedValueOnce(createMockStream([repeatedToolCall]))
      .mockResolvedValueOnce(createMockStream([repeatedToolCall]))
      .mockResolvedValueOnce(createMockStream([repeatedToolCall]))
      .mockResolvedValueOnce(createMockStream([finalText]));

    const openai = {
      chat: { completions: { create } },
    } as unknown as import("openai").default;
    const execute = vi.fn().mockResolvedValue({ title: "Example", content: "Result" });
    const tool: AgentTool = {
      name: "web_extract",
      description: "extract web page",
      parameters: { type: "object", properties: {} },
      execute,
    };
    const { controller, chunks } = createController();

    await runReActLoop({
      openai,
      model: "test-model",
      messages: [{ role: "user", content: "总结这个链接" }],
      tools: [{ type: "function", function: { name: "web_extract", description: "", parameters: {} } }],
      toolMap: new Map([["web_extract", tool]]),
      toolContext: { userId: "user-1", model: "test-model" },
      enableThinking: false,
      controller,
      encoder: new TextEncoder(),
      responseId: "assistant-1",
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(6);
    expect(create.mock.calls[5][0].tools).toBeUndefined();

    const events = chunks.map((chunk) => JSON.parse(new TextDecoder().decode(chunk).trim()));
    expect(events.some((event) => event.type === "text-delta" && event.delta === "这是最终总结。")).toBe(true);
  });
});
