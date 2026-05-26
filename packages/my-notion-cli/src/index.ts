#!/usr/bin/env node

import { runAuthCommand } from "./commands/auth.js";
import { runDocsCommand } from "./commands/docs.js";
import { runMcpCommand } from "./commands/mcp.js";
import { runTokensCommand } from "./commands/tokens.js";
import { writeError } from "./format/output.js";
import type { ParsedArgs } from "./types.js";

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      positionals.push(current);
      continue;
    }

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

  return { positionals, options };
}

function printHelp() {
  console.log(`My-Notion CLI

Usage:
  my-notion auth login --api-url <url> --token <mnt_token>
  my-notion auth status
  my-notion auth logout
  my-notion tokens revoke-current
  my-notion docs create --title <title> [--content-file draft.md]
  my-notion docs fetch --id <documentId> [--format markdown]
  my-notion docs search --query <keyword> [--limit 10]
  my-notion docs list [--limit 20]
  my-notion docs update --id <documentId> [--title <title>] [--content-file draft.md] [--mode overwrite|append]
  my-notion docs archive --id <documentId>
  my-notion mcp serve --transport stdio

Global options:
  --api-url <url>      Override MY_NOTION_API_URL / saved config
  --token <token>      Override MY_NOTION_API_TOKEN / saved config
  --format <format>    json | pretty | table | ndjson | markdown
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.positionals[0];

  if (!command || command === "help" || args.options.help) {
    printHelp();
    return;
  }

  if (command === "auth") {
    await runAuthCommand(args);
    return;
  }

  if (command === "docs") {
    await runDocsCommand(args);
    return;
  }

  if (command === "mcp") {
    await runMcpCommand(args);
    return;
  }

  if (command === "tokens") {
    await runTokensCommand(args);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  writeError(error);
  process.exitCode = 1;
});
