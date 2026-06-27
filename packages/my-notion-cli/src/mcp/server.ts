import { runMyNotionMcpStdioServer } from "@mynotion/mcp";
import type { ParsedArgs } from "../types.js";

export async function runMcpStdioServer(args: ParsedArgs) {
  await runMyNotionMcpStdioServer({
    transport: "stdio",
    options: args.options,
  });
}
