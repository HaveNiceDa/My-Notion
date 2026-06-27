import { describe, expect, it } from "vitest";
import { createMyNotionMcpServer } from "../src/index.js";

describe("@mynotion/mcp", () => {
  it("creates a standalone MCP server instance", () => {
    const server = createMyNotionMcpServer();

    expect(server).toBeTruthy();
  });
});
