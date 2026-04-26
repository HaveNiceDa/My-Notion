import { describe, it, expect, beforeEach } from "vitest";
import { useSearch } from "../hooks/use-search";

describe("useSearch", () => {
  beforeEach(() => {
    useSearch.setState({ isOpen: false });
  });

  it("initializes with isOpen=false", () => {
    expect(useSearch.getState().isOpen).toBe(false);
  });

  it("opens search", () => {
    useSearch.getState().onOpen();
    expect(useSearch.getState().isOpen).toBe(true);
  });

  it("closes search", () => {
    useSearch.getState().onOpen();
    useSearch.getState().onClose();
    expect(useSearch.getState().isOpen).toBe(false);
  });

  it("toggles search", () => {
    useSearch.getState().toggle();
    expect(useSearch.getState().isOpen).toBe(true);
    useSearch.getState().toggle();
    expect(useSearch.getState().isOpen).toBe(false);
  });
});
