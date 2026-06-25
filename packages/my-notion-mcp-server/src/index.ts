#!/usr/bin/env node

import { runMyNotionMcpStdioServer } from "./server.js";

function parseArgs(argv: string[]) {
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;

    const [rawKey, inlineValue] = current.slice(2).split("=", 2);
    const next = argv[index + 1];
    if (inlineValue !== undefined) {
      options[rawKey] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      options[rawKey] = next;
      index += 1;
    } else {
      options[rawKey] = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`My-Notion MCP Server

Usage:
  my-notion-mcp-server --transport stdio

Options:
  --transport stdio    Start the MCP server over STDIO
  --profile <name>     Select saved CLI profile. Defaults to prod
  --local              Use local/dev CLI profile
  --api-url <url>      Override MY_NOTION_API_URL / saved config / default online API
  --token <token>      Legacy token override. Prefer browser login through my-notion auth login

Recommended setup:
  my-notion auth login
  my-notion-mcp-server --transport stdio
`);
}

export {
  createMyNotionMcpServer,
  runMyNotionMcpStdioServer,
} from "./server.js";
export { registerMyNotionTools } from "./register-tools.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || options.h) {
    printHelp();
  } else {
    runMyNotionMcpStdioServer({
      transport: "stdio",
      options,
    }).catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
  }
}
