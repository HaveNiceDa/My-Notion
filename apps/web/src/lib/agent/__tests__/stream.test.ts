import { describe, it, expect } from "vitest";
import { enqueueEvent } from "../stream";
import type { AgentStreamEvent } from "../stream";

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
});
