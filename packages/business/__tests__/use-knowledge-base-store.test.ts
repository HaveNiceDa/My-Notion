import { describe, it, expect, beforeEach } from "vitest";
import { useKnowledgeBaseStore } from "../hooks/use-knowledge-base-store";

describe("useKnowledgeBaseStore", () => {
  beforeEach(() => {
    useKnowledgeBaseStore.setState({ enabled: false });
  });

  it("initializes with enabled=false", () => {
    expect(useKnowledgeBaseStore.getState().enabled).toBe(false);
  });

  it("toggles enabled state", () => {
    useKnowledgeBaseStore.getState().toggle();
    expect(useKnowledgeBaseStore.getState().enabled).toBe(true);
    useKnowledgeBaseStore.getState().toggle();
    expect(useKnowledgeBaseStore.getState().enabled).toBe(false);
  });

  it("sets enabled directly", () => {
    useKnowledgeBaseStore.getState().setEnabled(true);
    expect(useKnowledgeBaseStore.getState().enabled).toBe(true);
  });
});
