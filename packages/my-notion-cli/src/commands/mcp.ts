import { readStringOption } from "../config/store.js";
import { runMcpStdioServer } from "../mcp/server.js";
import type { ParsedArgs } from "../types.js";

export async function runMcpCommand(args: ParsedArgs) {
  const action = args.positionals[1];

  if (action !== "serve") {
    throw new Error("Unknown mcp command. Usage: my-notion mcp serve --transport stdio");
  }

  const transport = readStringOption(args.options, "transport") ?? "stdio";
  if (transport !== "stdio") {
    // Be explicit here: accepting unknown transports would imply unsupported auth semantics.
    throw new Error("Unsupported MCP transport. Only `stdio` is available.");
  }

  await runMcpStdioServer(args);
}
