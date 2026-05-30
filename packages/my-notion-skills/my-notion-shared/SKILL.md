---
name: "my-notion-shared"
description: "Guides My-Notion CLI setup, authentication, output formats, and safety. Invoke before using My-Notion CLI or when configuring PAT/API URL."
---

# My-Notion Shared

Use this skill whenever an Agent needs to use the My-Notion CLI, configure authentication, validate access, or understand CLI safety boundaries.

## Prerequisites

- The CLI package is `@notion/my-notion-cli`.
- The binary name is `my-notion` after installation or linking.
- In this monorepo, the development entry can be run with:

```bash
pnpm --filter @notion/my-notion-cli dev <command>
```

- For built output, run:

```bash
pnpm --filter @notion/my-notion-cli build
node packages/my-notion-cli/dist/index.js <command>
```

## Authentication

The CLI talks to My-Notion through Convex HTTP Actions. It requires:

- `apiUrl`: optional. When omitted, the CLI defaults to `https://handsome-stoat-500.convex.site`. Use a Convex `.site` URL such as `https://<deployment>.convex.site` for non-default deployments.
- `token`: a My-Notion PAT with `mnt_` prefix

Login command:

```bash
my-notion auth login --token <mnt_token>
```

Status command:

```bash
my-notion auth status
```

Logout clears the saved local PAT from `~/.my-notion/config.json` but does not revoke it remotely:

```bash
my-notion auth logout
```

Revoke the currently configured PAT remotely when the user wants to invalidate this credential:

```bash
my-notion tokens revoke-current --format json
```

Configuration is stored in:

```text
~/.my-notion/config.json
```

Environment variables override saved config:

```bash
export MY_NOTION_API_URL="https://<deployment>.convex.site"
export MY_NOTION_API_TOKEN="mnt_xxx"
```

`MY_NOTION_API_URL` is optional for the default online My-Notion deployment.

Command flags have the highest priority:

```bash
my-notion auth status --api-url <url> --token <token>
```

## Output Formats

Use `--format` to control output:

- `json`: compact machine-readable JSON, best for Agents
- `pretty`: formatted JSON for humans
- `table`: tabular output for quick inspection
- `ndjson`: one JSON object per line
- `markdown`: document body only, supported by `docs fetch`

Agents should prefer `--format json` for create, search, list, and update, and `--format markdown` for reading document content.

## Safety Rules

- Never print full PAT tokens unless the user explicitly asks for token debugging.
- Prefer temporary config by setting `HOME` in automated tests so local user config is not overwritten.
- Do not store PAT tokens in repository files, docs, logs, or generated skills.
- Use `auth logout` for local cleanup and `tokens revoke-current` when the PAT must be invalidated server-side.
- Use `docs search` before creating duplicate documents if the requested document may already exist.
- Use `docs update --mode append` when adding new notes to an existing document.
- Use `docs update --mode overwrite` only when the user clearly asks to replace the document content.

## Verification

The current CLI end-to-end smoke test is:

```bash
pnpm e2e:cli
```

This test builds the CLI, creates a temporary PAT in the dev Convex deployment, validates auth, creates/fetches/updates/searches a document, and revokes the temporary PAT at the end.

## Related References

Read the docs skill command reference before composing document commands:

```text
packages/my-notion-skills/my-notion-docs/references/cli-commands.md
```
