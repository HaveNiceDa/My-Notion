import { describe, it, expect, beforeEach } from "vitest";
import { useAIModelStore } from "../hooks/use-ai-model-store";
import { AI_MODELS, DEFAULT_MODEL } from "@notion/ai/config";

describe("useAIModelStore", () => {
  beforeEach(() => {
    useAIModelStore.setState({ model: DEFAULT_MODEL });
  });

  it("initializes with default model", () => {
    expect(useAIModelStore.getState().model).toBe(DEFAULT_MODEL);
  });

  it("sets a new model", () => {
    const newModel = AI_MODELS[1];
    useAIModelStore.getState().setModel(newModel);
    expect(useAIModelStore.getState().model).toBe(newModel);
  });

  it("exports AI_MODELS and AIModel type", () => {
    expect(AI_MODELS.length).toBeGreaterThan(0);
  });
});
