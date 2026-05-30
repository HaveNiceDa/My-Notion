import { afterEach, describe, expect, it, vi } from "vitest";
import { getOutputFormat, writeError, writeOutput } from "../src/format/output.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("output formatting", () => {
  it("accepts supported formats and falls back for unknown values", () => {
    expect(getOutputFormat({ format: "json" })).toBe("json");
    expect(getOutputFormat({ format: "pretty" })).toBe("pretty");
    expect(getOutputFormat({ format: "table" })).toBe("table");
    expect(getOutputFormat({ format: "ndjson" })).toBe("ndjson");
    expect(getOutputFormat({ format: "markdown" })).toBe("markdown");
    expect(getOutputFormat({ format: "yaml" }, "pretty")).toBe("pretty");
    expect(getOutputFormat({}, "table")).toBe("table");
  });

  it("writes compact JSON by default", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    writeOutput({ ok: true });

    expect(log).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
  });

  it("writes one JSON object per line for ndjson arrays", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    writeOutput([{ id: "a" }, { id: "b" }], "ndjson");

    expect(log).toHaveBeenNthCalledWith(1, JSON.stringify({ id: "a" }));
    expect(log).toHaveBeenNthCalledWith(2, JSON.stringify({ id: "b" }));
  });

  it("writes only document markdown for markdown output", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    writeOutput({ contentMarkdown: "# Title" }, "markdown");
    writeOutput({}, "markdown");

    expect(log).toHaveBeenNthCalledWith(1, "# Title");
    expect(log).toHaveBeenNthCalledWith(2, "");
  });

  it("writes human readable errors without leaking stack traces", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    writeError(new Error("Something failed"));

    expect(error).toHaveBeenCalledWith("Something failed");
  });
});
