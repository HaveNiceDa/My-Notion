import { describe, it, expect, beforeEach } from "vitest";
import { useSettings } from "../hooks/use-settings";

describe("useSettings", () => {
  beforeEach(() => {
    useSettings.setState({ isOpen: false });
  });

  it("initializes with isOpen=false", () => {
    expect(useSettings.getState().isOpen).toBe(false);
  });

  it("opens settings", () => {
    useSettings.getState().onOpen();
    expect(useSettings.getState().isOpen).toBe(true);
  });

  it("closes settings", () => {
    useSettings.getState().onOpen();
    useSettings.getState().onClose();
    expect(useSettings.getState().isOpen).toBe(false);
  });
});
