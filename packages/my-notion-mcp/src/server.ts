import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMyNotionTools } from "./register-tools.js";

export type RunMyNotionMcpServerOptions = {
  transport?: "stdio";
  options?: Record<string, string | boolean>;
};

export function createMyNotionMcpServer(options: RunMyNotionMcpServerOptions = {}) {
  const server = new McpServer({
    name: "my-notion",
    version: "0.1.0",
  });
  registerMyNotionTools(server, { options: options.options });
  return server;
}

export async function runMyNotionMcpStdioServer(options: RunMyNotionMcpServerOptions = {}) {
  if (options.transport && options.transport !== "stdio") {
    // 第一版只支持 STDIO transport；HTTP/OAuth 需要单独设计鉴权边界。
    throw new Error("Unsupported MCP transport. Only `stdio` is available.");
  }

  const server = createMyNotionMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
