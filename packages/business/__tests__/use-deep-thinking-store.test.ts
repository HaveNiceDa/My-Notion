import { describe, it, expect, beforeEach } from "vitest";
import { useDeepThinkingStore } from "../hooks/use-deep-thinking-store";

describe("useDeepThinkingStore", () => {
  beforeEach(() => {
    useDeepThinkingStore.setState({ enabled: false });
  });

  it("initializes with enabled=false", () => {
    expect(useDeepThinkingStore.getState().enabled).toBe(false);
  });

  it("toggles enabled state", () => {
    useDeepThinkingStore.getState().toggle();
    expect(useDeepThinkingStore.getState().enabled).toBe(true);
  });

  it("sets enabled directly", () => {
    useDeepThinkingStore.getState().setEnabled(true);
    expect(useDeepThinkingStore.getState().enabled).toBe(true);
  });
});
