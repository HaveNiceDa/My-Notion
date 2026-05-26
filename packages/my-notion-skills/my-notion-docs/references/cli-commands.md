# My-Notion CLI Commands

This reference lists the first supported My-Notion CLI commands for Agents.

## Binary

Installed or linked binary:

```bash
my-notion <command>
```

Monorepo development entry:

```bash
pnpm --filter @notion/my-notion-cli dev <command>
```

Built entry:

```bash
pnpm --filter @notion/my-notion-cli build
node packages/my-notion-cli/dist/index.js <command>
```

## Global Options

```bash
--api-url <url>
--token <mnt_token>
--format <json|pretty|table|ndjson|markdown>
```

Priority order:

1. Command flags: `--api-url`, `--token`
2. Environment variables: `MY_NOTION_API_URL`, `MY_NOTION_API_TOKEN`
3. Saved config: `~/.my-notion/config.json`

Agents should use `--format json` unless the desired output is Markdown content.

## Auth

Login and save config:

```bash
my-notion auth login --api-url https://<deployment>.convex.site --token <mnt_token> --format json
```

Check current auth:

```bash
my-notion auth status --format json
```

Clear the saved local PAT:

```bash
my-notion auth logout --format json
```

Check with explicit credentials:

```bash
my-notion auth status --api-url https://<deployment>.convex.site --token <mnt_token> --format json
```

Do not use `--show-token` unless debugging token storage with explicit user approval.

## Tokens

Revoke the current PAT on the server:

```bash
my-notion tokens revoke-current --format json
```

Typical output:

```json
{
  "id": "kd7...",
  "name": "My-Notion CLI Token",
  "tokenPrefix": "mnt_xxxxxxxx",
  "scopes": ["docs:read", "docs:write"],
  "createdAt": 1779690000000,
  "lastUsedAt": 1779690100000,
  "expiresAt": null,
  "revokedAt": 1779690200000
}
```

Use `auth logout` for local cleanup only. Use `tokens revoke-current` when the credential should stop working remotely.

## Error Output

Machine API responses include a stable `requestId` in the JSON envelope and `x-request-id` response header.

When the server returns a structured error, the CLI prints the request id with the error message:

```text
UNAUTHORIZED (requestId: req_xxx)
```

Use `requestId` to correlate CLI/MCP failures with server logs or Machine API audit records. Network-level failures such as `fetch failed` may not have a request id because the server did not return a response.

Machine API audit records include request id, token id, token prefix, user id, endpoint path, HTTP method, status, required scope, error code, duration, and timestamp. PAT plaintext and token hashes are never recorded.

### Error Code Contract

Machine API errors use stable HTTP status and `error.code` pairs:

| HTTP | Code | Typical trigger | Agent handling |
| --- | --- | --- | --- |
| `401` | `UNAUTHORIZED` | Missing Bearer token or unknown token hash | Ask the user to run `auth login` or provide a valid PAT. |
| `401` | `TOKEN_REVOKED` | PAT was revoked on the server | Stop retrying and ask the user to create a new PAT. |
| `401` | `TOKEN_EXPIRED` | PAT `expiresAt` is in the past | Stop retrying and ask the user to create a new PAT. |
| `403` | `INSUFFICIENT_SCOPE` | Token lacks the required scope, such as `docs:write` | Do not retry; ask for a token with the required scope. |
| `404` | `NOT_FOUND` | Document or CLI endpoint does not exist, or the document is archived / not owned by the token user | Re-check the document id or search again before retrying. |
| `422` | `VALIDATION_ERROR` | Request body or path parameter is invalid, such as an empty title | Fix the command arguments or request payload before retrying. |
| `429` | `RATE_LIMITED` | Token exceeded the fixed-window quota | Respect `Retry-After`; the CLI does not retry structured rate-limit errors. |
| `500` | `INTERNAL_ERROR` | Unexpected server-side failure | Surface `requestId` and retry only after checking logs or audit records. |

Rate-limited requests return HTTP `429` with structured code `RATE_LIMITED`, `requestId`, and rate-limit headers:

```text
Retry-After: 42
x-ratelimit-limit: 30
x-ratelimit-remaining: 0
x-ratelimit-reset: 1779766800000
```

## Retry and Timeout

The CLI HTTP client uses a conservative retry policy for Machine API calls:

- Each attempt times out after 10 seconds.
- The CLI makes up to 3 attempts.
- Retries use exponential backoff starting at 300ms.
- Retries apply to network failures, timeouts, HTTP 408, generic HTTP 429, and HTTP 5xx responses.
- Structured `RATE_LIMITED` errors are not retried by the CLI to avoid amplifying quota pressure.
- Structured 4xx business errors such as `UNAUTHORIZED`, `TOKEN_REVOKED`, `TOKEN_EXPIRED`, `INSUFFICIENT_SCOPE`, and `NOT_FOUND` are not retried.

Archive cleanup is idempotent: repeated `docs archive` calls for an already archived document return the archived document instead of failing.

## Rate Limits

Machine API rate limits use a fixed 60-second window and the dimension `tokenId + method + endpoint`.

- Read endpoints: 120 requests per minute.
- Write endpoints: 30 requests per minute.
- `GET /cli/v1/auth/status`: 60 requests per minute.
- `POST /cli/v1/tokens/revoke-current`: 10 requests per minute.

Endpoint paths are normalized before counting. For example, `GET /cli/v1/documents/<id>` is counted as `GET /cli/v1/documents/:id`.

## Documents

### Create

Create from a Markdown file:

```bash
my-notion docs create --title "Project Plan" --content-file /tmp/project-plan.md --format json
```

Create with short inline content:

```bash
my-notion docs create --title "Quick Note" --content "Remember to review the roadmap." --format json
```

Typical output:

```json
{
  "id": "j57...",
  "title": "Project Plan",
  "contentMarkdown": "# Project Plan\n\n...",
  "contentFormat": "blocknote-json",
  "isArchived": false,
  "isPublished": false,
  "isInKnowledgeBase": true,
  "lastEditedTime": 1779690000000
}
```

### Fetch

Fetch JSON metadata and content:

```bash
my-notion docs fetch --id <documentId> --format json
```

Fetch Markdown body only:

```bash
my-notion docs fetch --id <documentId> --format markdown
```

Use Markdown output for summarization, rewriting, diffing, and append decisions.

### Export

Export Markdown to stdout:

```bash
my-notion docs export --id <documentId> --format markdown
```

Export Markdown to a local file:

```bash
my-notion docs export --id <documentId> --output /tmp/document.md --format markdown
```

Export JSON metadata and content to a local file:

```bash
my-notion docs export --id <documentId> --output /tmp/document.json --format json
```

When `--output` is provided, stdout returns a JSON summary containing `id`, `title`, `output`, `format`, and `bytes`.

### Import

Import a local Markdown file as a new document:

```bash
my-notion docs import --title "Imported Document" --file /tmp/document.md --format json
```

`--content-file` is accepted as an alias for `--file`. Import creates a new document and does not modify existing documents.

### Search

Search by keyword:

```bash
my-notion docs search --query "agent roadmap" --limit 10 --format json
```

Short alias for query:

```bash
my-notion docs search --q "agent roadmap" --limit 10 --format json
```

Expected output is an array of document objects.

### List

List recent documents:

```bash
my-notion docs list --limit 20 --format json
```

Use this when the user asks to browse or inspect recent documents without a search keyword.

### Update

Append Markdown content:

```bash
my-notion docs update --id <documentId> --content-file /tmp/append.md --mode append --format json
```

Overwrite content:

```bash
my-notion docs update --id <documentId> --content-file /tmp/full.md --mode overwrite --format json
```

Update title only:

```bash
my-notion docs update --id <documentId> --title "New Title" --format json
```

Update title and append content:

```bash
my-notion docs update --id <documentId> --title "New Title" --content-file /tmp/append.md --mode append --format json
```

### Archive

Soft-archive a document so it no longer appears in normal fetch/search/list results:

```bash
my-notion docs archive --id <documentId> --format json
```

Typical output includes `isArchived: true`.

## MCP

Start the STDIO MCP server:

```bash
my-notion mcp serve --transport stdio
```

Development entry:

```bash
pnpm --filter @notion/my-notion-cli dev mcp serve --transport stdio
```

The first MCP version exposes:

- `my_notion_docs_search`
- `my_notion_docs_fetch`
- `my_notion_docs_create`
- `my_notion_docs_update`

Writing tools default to dry-run mode. Set `dryRun: false` only after explicit user approval.

## Recommended Agent Patterns

Create a new generated document:

```bash
cat > /tmp/my-notion-generated.md <<'EOF'
# Title

Generated content...
EOF

my-notion docs create --title "Title" --content-file /tmp/my-notion-generated.md --format json
```

Find and append to an existing document:

```bash
my-notion docs search --query "weekly report" --limit 5 --format json
my-notion docs update --id <documentId> --content-file /tmp/new-section.md --mode append --format json
```

Read before overwrite:

```bash
my-notion docs fetch --id <documentId> --format markdown
my-notion docs update --id <documentId> --content-file /tmp/replacement.md --mode overwrite --format json
```

Use temporary HOME for tests:

```bash
HOME="$(mktemp -d)" my-notion auth login --api-url <url> --token <token> --format json
```

## End-to-End Verification

Run the repository smoke test:

```bash
pnpm e2e:cli
```

Run the Machine API error contract test:

```bash
pnpm e2e:cli:errors
```

The smoke test:

- builds the CLI
- creates a temporary PAT in the dev Convex deployment
- runs `auth login`
- creates a document
- fetches it as Markdown
- appends content
- searches by a unique keyword
- exports the test document to Markdown
- imports the exported Markdown as a new document
- archives both test documents
- revokes the temporary PAT
- verifies the revoked PAT no longer authenticates
- clears the saved local PAT with `auth logout`

The error contract test:

- verifies missing and invalid token responses return `401 UNAUTHORIZED`
- verifies read-only tokens return `403 INSUFFICIENT_SCOPE` for write APIs
- verifies expired and revoked tokens return `TOKEN_EXPIRED` and `TOKEN_REVOKED`
- verifies invalid request payloads return `422 VALIDATION_ERROR`
- verifies archived documents return `404 NOT_FOUND`
- verifies rate limiting returns `429 RATE_LIMITED` with `Retry-After` and `x-ratelimit-*` headers
- verifies every structured response includes matching body `requestId` and `x-request-id`

## Current Limitations

- Markdown to BlockNote conversion currently stores content as paragraph blocks.
- CLI can revoke the current PAT, but arbitrary token list/revoke still belongs to the authenticated Web API/UI.
- E2E soft-archives its test document and revokes the temporary PAT.
