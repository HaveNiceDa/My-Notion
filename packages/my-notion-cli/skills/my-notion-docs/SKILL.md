---
name: "my-notion-docs"
description: "Uses My-Notion CLI to create, read, search, update, import, and export documents. Invoke when user asks an Agent to manage My-Notion docs."
---

# My-Notion Docs

Use this skill when an Agent needs to create, read, search, list, update, import, export, or archive My-Notion documents through the My-Notion CLI.

Before using this skill, ensure `my-notion-shared` authentication guidance is satisfied.

## Content Format Contract

- Agents read and write Markdown only.
- My-Notion stores editor content as BlockNote JSON internally.
- The server converts Markdown <-> BlockNote blocks for CLI, Skills, MCP, and Web Agent flows.
- Use returned `contentMarkdown` as the editable view when modifying existing documents.
- Do not generate, parse, or ask the user to provide BlockNote JSON.

## Core Workflow

1. Check CLI setup and authentication silently when needed:

```bash
my-notion config init --check --format json
```

2. If authentication is missing or invalid, run browser login and send only the clickable authorization link plus visible user code:

```bash
my-notion auth login --no-open
```

3. Search before creating if duplicates are possible:

```bash
my-notion docs search --query "<keywords>" --limit 5 --format json
```

4. Create or update content using a temporary Markdown file:

```bash
my-notion docs create --title "<title>" --content-file /tmp/my-notion-doc.md --format json
```

5. Fetch the final document if the user needs confirmation:

```bash
my-notion docs fetch --id <documentId> --format markdown
```

## Create Documents

Use `docs create` when the user wants a new note, plan, summary, report, or generated document.

Preferred pattern:

```bash
cat > /tmp/my-notion-doc.md <<'EOF'
# Title

Content...
EOF

my-notion docs create --title "Title" --content-file /tmp/my-notion-doc.md --format json
```

Use `--content` only for very short content:

```bash
my-notion docs create --title "Quick Note" --content "Short content" --format json
```

Expected JSON fields include:

- `id`
- `title`
- `contentMarkdown`
- `contentFormat`
- `isInKnowledgeBase`
- `lastEditedTime`

## Read Documents

Use `docs fetch` when the user provides a document ID or when another CLI result includes `id`.

Machine-readable result:

```bash
my-notion docs fetch --id <documentId> --format json
```

Markdown content only:

```bash
my-notion docs fetch --id <documentId> --format markdown
```

The Markdown returned by `docs fetch` and `docs export` is serialized from the internal BlockNote JSON. Use it for summaries, edits, and update round-trips.

Prefer `--format markdown` when the next step is summarization, rewriting, diffing, or appending content.

## Import and Export Documents

Use `docs export` when the user asks to back up, migrate, edit locally, or hand a My-Notion document to another tool:

```bash
my-notion docs export --id <documentId> --output /tmp/my-notion-doc.md --format markdown
```

Use `docs import` when the user provides a Markdown file that should become a new My-Notion document:

```bash
my-notion docs import --title "Imported Document" --file /tmp/my-notion-doc.md --format json
```

For edit-roundtrip workflows, export to a temporary Markdown file, modify the file, then import as a new document or update the original document explicitly. Do not edit internal BlockNote JSON.

## Search Documents

Use `docs search` when the user asks to find existing documents or when you need to avoid duplicates.

```bash
my-notion docs search --query "<keywords>" --limit 10 --format json
```

If the user asks to browse recent documents rather than search by keyword, use:

```bash
my-notion docs list --limit 20 --format json
```

## Update Documents

Use append mode for adding notes, follow-ups, meeting minutes, or generated sections:

```bash
my-notion docs update --id <documentId> --content-file /tmp/append.md --mode append --format json
```

Use overwrite mode only when the user explicitly wants replacement:

```bash
my-notion docs update --id <documentId> --title "New Title" --content-file /tmp/full.md --mode overwrite --format json
```

If only the title changes:

```bash
my-notion docs update --id <documentId> --title "New Title" --format json
```

## Archive Documents

Use archive only when the user explicitly asks to remove a document from normal views, or when cleaning up temporary E2E/test documents:

```bash
my-notion docs archive --id <documentId> --format json
```

## Agent Behavior Rules

- Always preserve returned `documentId` values in your working context.
- Prefer temporary Markdown files over shell-escaped inline content for non-trivial documents.
- Use `--format json` when parsing command output.
- Use `--format markdown` when reading document bodies for language tasks.
- Use returned `contentMarkdown` as the source for document updates.
- Do not generate or parse BlockNote JSON.
- Keep user-facing output concise: report the action result and document id; do not print auth status, config paths, token prefixes, profile details, or raw CLI JSON unless the user asks.
- When login is required, share the authorization URL as a clickable Markdown link, e.g. `[打开 My-Notion CLI 授权](https://...)`.
- Use `docs export --output` for backup, local editing, or handoff to external tools.
- Use `docs import --file` for Markdown files that should become new My-Notion documents.
- Ask the user before overwriting existing document content unless they explicitly requested overwrite.
- Ask the user before archiving a non-test document unless they explicitly requested removal.
- Do not expose PAT tokens in final answers.
- Report the created or updated document ID to the user after successful writes.

## Error Handling

- If auth is missing, expired, revoked, or invalid, run browser login and send only the clickable authorization link plus the visible user code.
- If `docs fetch` returns not found, confirm the document ID and whether it belongs to the authenticated user.
- If search returns many results, show the top few titles and ask which document to update.

## Reference

Read exact command syntax and examples from:

```text
references/cli-commands.md
```
