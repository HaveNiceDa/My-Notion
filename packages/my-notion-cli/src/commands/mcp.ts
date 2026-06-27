import { readStringOption } from "../config/store.js";
import { runMyNotionMcpStdioServer } from "@mynotion/mcp";
import type { ParsedArgs } from "../types.js";

export async function runMcpCommand(args: ParsedArgs) {
  const action = args.positionals[1];

  if (action !== "serve") {
    throw new Error("Unknown mcp command. Usage: my-notion mcp serve --transport stdio");
  }

  const transport = readStringOption(args.options, "transport") ?? "stdio";
  if (transport !== "stdio") {
    // 明确拒绝未知 transport，避免让调用方误以为已支持 HTTP/OAuth 鉴权语义。
    throw new Error("Unsupported MCP transport. Only `stdio` is available.");
  }

  await runMyNotionMcpStdioServer({
    transport: "stdio",
    options: args.options,
  });
}
