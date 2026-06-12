import { describe, expect, it } from "vitest";
import type { ParsedArgs } from "../src/types.js";

function args(positionals: string[], options: ParsedArgs["options"] = {}): ParsedArgs {
  return {
    positionals,
    options: {
      "api-url": "https://example.convex.site",
      token: "mnt_test",
      format: "json",
      ...options,
    },
  };
}

describe("runWhiteboardsCommand", () => {
  it("rejects all whiteboard commands because the feature is retired", async () => {
    const { runWhiteboardsCommand } = await import("../src/commands/whiteboards.js");

    await expect(runWhiteboardsCommand(args(["whiteboards", "list"]))).rejects.toThrow(
      "Whiteboards are no longer supported by My-Notion CLI.",
    );
  });
});
