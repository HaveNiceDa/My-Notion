import { describe, expect, it } from "vitest";
import { AgentTracer, summarizeForTrace } from "../trace";
import type { AgentTraceEvent } from "../trace";

describe("AgentTracer", () => {
  it("输出包含 traceId、类型和基础 metadata 的结构化事件", () => {
    const events: AgentTraceEvent[] = [];
    const tracer = new AgentTracer({
      traceId: "trace-1",
      baseMetadata: { model: "test-model" },
      sink: (event) => events.push(event),
    });

    tracer.mark("run_start", { toolNames: ["knowledge_search"] });

    expect(events).toHaveLength(1);
    expect(events[0].traceId).toBe("trace-1");
    expect(events[0].type).toBe("run_start");
    expect(events[0].metadata).toMatchObject({
      model: "test-model",
      toolNames: ["knowledge_search"],
    });
  });

  it("event 支持记录 durationMs", () => {
    const events: AgentTraceEvent[] = [];
    const tracer = new AgentTracer({
      traceId: "trace-2",
      sink: (event) => events.push(event),
    });

    tracer.event("tool_end", 12.4, { toolName: "document_read" });

    expect(events[0]).toMatchObject({
      type: "tool_end",
      durationMs: 12,
      metadata: { toolName: "document_read" },
    });
  });

  it("summarizeForTrace 会脱敏敏感字段并截断长内容", () => {
    const summary = summarizeForTrace({
      query: "hello",
      apiKey: "secret",
      content: "x".repeat(1000),
    });

    expect(summary).toContain("hello");
    expect(summary).toContain("[redacted]");
    expect(summary.length).toBeLessThanOrEqual(803);
    expect(summary).not.toContain("secret");
  });
});
