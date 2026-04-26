import { describe, it, expect, beforeEach } from "vitest";
import { useThinkingProcessStore } from "../hooks/use-thinking-process-store";

describe("useThinkingProcessStore", () => {
  beforeEach(() => {
    useThinkingProcessStore.getState().clearSteps();
  });

  it("initializes with empty steps", () => {
    const state = useThinkingProcessStore.getState();
    expect(state.steps).toEqual([]);
    expect(state.isExpanded).toBe(true);
    expect(state.isVisible).toBe(false);
  });

  it("adds a step and sets isVisible=true", () => {
    useThinkingProcessStore.getState().addStep("query", "test content");
    const state = useThinkingProcessStore.getState();
    expect(state.steps.length).toBe(1);
    expect(state.steps[0].type).toBe("query");
    expect(state.steps[0].content).toBe("test content");
    expect(state.isVisible).toBe(true);
  });

  it("adds step with details", () => {
    useThinkingProcessStore.getState().addStep("documents", "found docs", "doc1,doc2");
    const step = useThinkingProcessStore.getState().steps[0];
    expect(step.details).toBe("doc1,doc2");
  });

  it("limits steps to 6", () => {
    for (let i = 0; i < 10; i++) {
      useThinkingProcessStore.getState().addStep("query", `step ${i}`);
    }
    expect(useThinkingProcessStore.getState().steps.length).toBe(6);
  });

  it("clears steps and resets state", () => {
    useThinkingProcessStore.getState().addStep("query", "test");
    useThinkingProcessStore.getState().clearSteps();
    const state = useThinkingProcessStore.getState();
    expect(state.steps).toEqual([]);
    expect(state.isExpanded).toBe(true);
    expect(state.isVisible).toBe(false);
  });

  it("toggles expanded state", () => {
    expect(useThinkingProcessStore.getState().isExpanded).toBe(true);
    useThinkingProcessStore.getState().toggleExpanded();
    expect(useThinkingProcessStore.getState().isExpanded).toBe(false);
  });

  it("sets visibility", () => {
    useThinkingProcessStore.getState().setVisible(false);
    expect(useThinkingProcessStore.getState().isVisible).toBe(false);
  });

  it("setSteps updates visibility based on length", () => {
    useThinkingProcessStore.getState().setSteps([
      { id: "1", timestamp: new Date(), type: "query", content: "test" },
    ]);
    expect(useThinkingProcessStore.getState().isVisible).toBe(true);

    useThinkingProcessStore.getState().setSteps([]);
    expect(useThinkingProcessStore.getState().isVisible).toBe(false);
  });
});
