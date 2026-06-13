---
name: my-notion-mcp
description: Run the My-Notion MCP STDIO server so MCP clients can create, fetch, search, and update My-Notion documents through the CLI-backed API.
---

# My-Notion MCP

Use this skill when an Agent or MCP-capable client needs direct tool access to My-Notion documents instead of shelling out to individual CLI commands.

## Prerequisites

- The `my-notion` CLI must be installed, linked, or run from the monorepo.
- npm latest install: `npm install -g @mynotion/cli@latest`; Agent Skills install: `npx skills add @mynotion/cli -y -g`.
- Authentication must already be configured by browser-based `my-notion auth login`; `MY_NOTION_API_TOKEN` is a legacy/CI fallback. `MY_NOTION_API_URL` is optional for the default online deployment.
- In Agent mode, run `my-notion auth login --no-open`, send the printed authorization URL as a clickable Markdown link, then retry after approval.
- Do not pass full PAT values through MCP tool arguments. The MCP server reads credentials from CLI config or environment variables.

## Content Format Contract

- MCP clients read and write Markdown only.
- My-Notion stores editor content as BlockNote JSON internally.
- The MCP server and Machine API expose `contentMarkdown` as the Agent-editable view.
- The server handles Markdown <-> BlockNote blocks conversion.
- Do not generate, parse, or pass BlockNote JSON in MCP tool arguments.

## Start Server

Development entry:

```bash
pnpm --filter @mynotion/cli dev mcp serve --transport stdio
```

Built entry:

```bash
pnpm --filter @mynotion/cli build
node packages/my-notion-cli/dist/index.js mcp serve --transport stdio
```

Installed binary:

```bash
my-notion mcp serve --transport stdio
```

Only `stdio` transport is supported in the first version. Do not assume HTTP MCP or OAuth discovery exists.

## Real Client Verification

Use this repository E2E when validating behavior with a real MCP SDK client:

```bash
pnpm e2e:mcp:client
```

This script uses `@modelcontextprotocol/sdk` `Client + StdioClientTransport` and verifies:

- auth failure returns `isError: true` with `structuredContent.error`
- tools/list discovers `my_notion_docs_search`, `my_notion_docs_fetch`, `my_notion_docs_create`, and `my_notion_docs_update`
- create/update dry-run returns `confirmationRequired: true` and explicit no-write text
- real create/fetch/update/search works after explicit approval by setting `dryRun: false`
- test documents are archived and temporary PAT credentials are revoked

Minimal SDK client shape:

```js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "my-agent", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: "my-notion",
  args: ["mcp", "serve", "--transport", "stdio"],
});

await client.connect(transport);
const tools = await client.listTools();
const preview = await client.callTool({
  name: "my_notion_docs_create",
  arguments: {
    title: "MCP Dry Run",
    contentMarkdown: "# MCP Dry Run\n\nPreview only.",
    dryRun: true,
  },
});
await client.close();
```

## Tools

### `my_notion_docs_search`

Search documents for the current PAT user.

Input:

```json
{
  "query": "roadmap",
  "limit": 10
}
```

Behavior:

- Read-only.
- Returns `structuredContent.documents`.
- Omit `query` to list recent documents through the search endpoint.

### `my_notion_docs_fetch`

Fetch one document by id.

Input:

```json
{
  "id": "j57..."
}
```

Behavior:

- Read-only.
- Returns `structuredContent.document` and `structuredContent.markdown`.
- `structuredContent.markdown` is serialized from internal BlockNote JSON and should be used for Agent edit round-trips.
- Use this before overwrite operations.

### `my_notion_docs_create`

Create a new Markdown-backed document.

Input:

```json
{
  "title": "Project Plan",
  "contentMarkdown": "# Project Plan\n\n...",
  "dryRun": true
}
```

Behavior:

- Writing tool.
- `dryRun` defaults to `true`.
- Dry-run returns `structuredContent.dryRun: true`, `structuredContent.confirmationRequired: true`, `inputFormat: "markdown"`, `targetFormat: "blocknote-json"`, a preview document with id `dry-run`, and a text fallback saying no document was created.
- Set `dryRun: false` only when the user explicitly approved creating the document.

### `my_notion_docs_update`

Update a document title and/or Markdown content.

Input:

```json
{
  "id": "j57...",
  "title": "Updated Title",
  "contentMarkdown": "New section",
  "mode": "append",
  "dryRun": true
}
```

Behavior:

- Writing tool.
- `mode` is `append` or `overwrite`; default is `append`.
- `dryRun` defaults to `true`.
- Dry-run returns `structuredContent.dryRun: true`, `structuredContent.confirmationRequired: true`, `inputFormat: "markdown"`, `targetFormat: "blocknote-json"`, an `update` preview, and a text fallback saying no document was updated.
- Fetch the document first before using `mode: "overwrite"`.
- Set `dryRun: false` only after explicit user approval.

## Output Contract

Every tool returns:

- `structuredContent`: machine-readable JSON for the MCP client.
- `content`: human-readable text fallback plus formatted JSON.

Agents should parse `structuredContent` first and use the text fallback only when the client does not expose structured content.

Error results return:

- `isError: true`
- `structuredContent.error.message`
- optional `structuredContent.error.code`
- optional `structuredContent.error.requestId`
- text fallback containing readable failure context and request id when available

## Safety Rules

- Never log or echo full PAT values.
- Prefer read-only tools first: search, then fetch.
- Use `dryRun: true` for create and update unless the user explicitly requested immediate execution.
- Do not use this skill for token management; use `my-notion-shared` and CLI auth/token commands instead.
