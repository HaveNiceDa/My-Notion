---
name: my-notion-mcp
description: Run the My-Notion MCP STDIO server so MCP clients can create, fetch, search, and update My-Notion documents through the CLI-backed API.
---

# My-Notion MCP

Use this skill when an Agent or MCP-capable client needs direct tool access to My-Notion documents instead of shelling out to individual CLI commands.

## Prerequisites

- The `my-notion` CLI must be installed, linked, or run from the monorepo.
- Authentication must already be configured by `my-notion auth login` or `MY_NOTION_API_TOKEN`; `MY_NOTION_API_URL` is optional for the default online deployment.
- Do not pass full PAT values through MCP tool arguments. The MCP server reads credentials from CLI config or environment variables.

## Start Server

Development entry:

```bash
pnpm --filter @notion/my-notion-cli dev mcp serve --transport stdio
```

Built entry:

```bash
pnpm --filter @notion/my-notion-cli build
node packages/my-notion-cli/dist/index.js mcp serve --transport stdio
```

Installed binary:

```bash
my-notion mcp serve --transport stdio
```

Only `stdio` transport is supported in the first version. Do not assume HTTP MCP or OAuth discovery exists.

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
- Dry-run returns `structuredContent.dryRun: true`, `structuredContent.confirmationRequired: true`, a preview document with id `dry-run`, and a text fallback saying no document was created.
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
- Dry-run returns `structuredContent.dryRun: true`, `structuredContent.confirmationRequired: true`, an `update` preview, and a text fallback saying no document was updated.
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
