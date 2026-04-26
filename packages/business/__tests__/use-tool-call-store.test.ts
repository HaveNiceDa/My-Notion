import { describe, it, expect, beforeEach } from "vitest";
import { useToolCallStore } from "../hooks/use-tool-call-store";

describe("useToolCallStore", () => {
  beforeEach(() => {
    useToolCallStore.getState().clearToolCalls();
  });

  it("initializes with empty toolCalls", () => {
    expect(useToolCallStore.getState().toolCalls).toEqual([]);
  });

  it("adds a tool call", () => {
    useToolCallStore.getState().addToolCall({
      id: "tc1",
      name: "webSearch",
      parameters: { query: "test" },
      status: "calling",
    });
    const tc = useToolCallStore.getState().toolCalls;
    expect(tc.length).toBe(1);
    expect(tc[0].id).toBe("tc1");
    expect(tc[0].name).toBe("webSearch");
    expect(tc[0].status).toBe("calling");
    expect(tc[0].timestamp).toBeInstanceOf(Date);
  });

  it("updates tool call status", () => {
    useToolCallStore.getState().addToolCall({
      id: "tc1",
      name: "webSearch",
      parameters: {},
      status: "calling",
    });
    useToolCallStore.getState().updateToolCallStatus("tc1", "executing");
    expect(useToolCallStore.getState().toolCalls[0].status).toBe("executing");
  });

  it("sets tool call result and status to completed", () => {
    useToolCallStore.getState().addToolCall({
      id: "tc1",
      name: "webSearch",
      parameters: {},
      status: "executing",
    });
    useToolCallStore.getState().setToolCallResult("tc1", { url: "https://example.com" });
    const tc = useToolCallStore.getState().toolCalls[0];
    expect(tc.result).toEqual({ url: "https://example.com" });
    expect(tc.status).toBe("completed");
  });

  it("sets tool call error and status to error", () => {
    useToolCallStore.getState().addToolCall({
      id: "tc1",
      name: "webSearch",
      parameters: {},
      status: "calling",
    });
    useToolCallStore.getState().setToolCallError("tc1", "Network timeout");
    const tc = useToolCallStore.getState().toolCalls[0];
    expect(tc.error).toBe("Network timeout");
    expect(tc.status).toBe("error");
  });

  it("clears all tool calls", () => {
    useToolCallStore.getState().addToolCall({
      id: "tc1",
      name: "webSearch",
      parameters: {},
      status: "calling",
    });
    useToolCallStore.getState().clearToolCalls();
    expect(useToolCallStore.getState().toolCalls).toEqual([]);
  });

  it("handles multiple tool calls independently", () => {
    useToolCallStore.getState().addToolCall({
      id: "tc1",
      name: "webSearch",
      parameters: {},
      status: "calling",
    });
    useToolCallStore.getState().addToolCall({
      id: "tc2",
      name: "ragSearch",
      parameters: {},
      status: "calling",
    });
    useToolCallStore.getState().updateToolCallStatus("tc1", "completed");
    const tcs = useToolCallStore.getState().toolCalls;
    expect(tcs[0].status).toBe("completed");
    expect(tcs[1].status).toBe("calling");
  });
});
