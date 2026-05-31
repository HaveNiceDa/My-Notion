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
  my-notion auth login [--profile prod|local] [--web-url <url>] [--api-url <url>]
  my-notion auth login --no-open
  my-notion auth login --token <mnt_token> [--api-url <url>]  # legacy
  my-notion auth status [--profile prod|local]
  my-notion auth logout [--profile prod|local]
  my-notion tokens revoke-current
  my-notion docs create --title <title> [--content-file draft.md]
  my-notion docs fetch --id <documentId> [--format markdown]
  my-notion docs search --query <keyword> [--limit 10]
  my-notion docs list [--limit 20]
  my-notion docs update --id <documentId> [--title <title>] [--content-file draft.md] [--mode overwrite|append]
  my-notion docs archive --id <documentId>
  my-notion docs export --id <documentId> [--output document.md]
  my-notion docs import --title <title> --file document.md
  my-notion mcp serve --transport stdio

Global options:
  --profile <name>    Select saved profile. Defaults to prod
  --local             Use local/dev login state and defaults. Online prod remains default
  --web-url <url>     Web URL used for browser authorization
  --api-url <url>      Override MY_NOTION_API_URL / saved config / default online API
  --token <token>      Legacy token override. Prefer browser login
  --format <format>    json | pretty | table | ndjson | markdown

Auth setup:
  First use: run my-notion auth login, open the printed authorization URL,
  approve access in the browser, and the CLI saves online auth at ~/.local/share/my-notion/config.json.
  For local debugging, use --local --web-url http://localhost:3000 --api-url <convex-site-url>.
  Local auth is stored separately at ~/.local/share/my-notion/config.local.json.
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
