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

The CLI talks to My-Notion through Convex HTTP Actions. The recommended setup is browser-based device authorization:

- `profile`: optional. Defaults to `prod`. Use `--profile local` or `--local` for local/dev testing.
- `webUrl`: the My-Notion Web URL used for browser authorization. Defaults to `https://notion-j9zj.vercel.app`; local debugging commonly uses `http://localhost:3000`.
- `apiUrl`: the Convex `.site` Machine API URL used after login. Defaults to `https://laudable-albatross-174.convex.site`.

First-time setup:

- Run `my-notion auth login --no-open` when operating as an Agent.
- Extract the printed authorization URL and ask the user to open it in the browser.
- The printed authorization URL contains only `user_code`; the CLI keeps the sensitive temporary `device_code` locally for polling.
- The user signs in with My-Notion if needed, returns to the authorization page automatically, and approves CLI access. Do not ask the user to paste a `mnt_` token into chat.
- The CLI saves the token locally in `~/.local/share/my-notion/config.json`; the config directory should be `0700` and the file should be `0600`.
- Later commands should reuse the saved local login token by default. Ask the user to authorize again only when the CLI reports missing, expired, revoked, or invalid auth.

Login command:

```bash
my-notion auth login --no-open
```

Local/dev login command:

```bash
my-notion auth login \
  --profile local \
  --web-url http://localhost:3000 \
  --api-url "https://<dev-deployment>.convex.site"
```

Status command:

```bash
my-notion auth status
```

Logout clears the saved local PAT from `~/.local/share/my-notion/config.json` but does not revoke it remotely:

```bash
my-notion auth logout
```

Revoke the currently configured PAT remotely when the user wants to invalidate this credential:

```bash
my-notion tokens revoke-current --format json
```

Configuration is stored in:

```text
~/.local/share/my-notion/config.json
```

For CI or isolated permission debugging, `MY_NOTION_CONFIG_PATH` can point to an alternate writable config file. If saving config fails with `EPERM` or `EACCES`, inspect ownership and permissions with `ls -lO@ ~/.local/share/my-notion ~/.local/share/my-notion/config.json`.

If the CLI reports `TOKEN_EXPIRED`, `TOKEN_REVOKED`, or `UNAUTHORIZED`, run `my-notion auth login --no-open` again and ask the user to open the authorization URL.

Environment variables override saved config:

```bash
export MY_NOTION_API_URL="https://<deployment>.convex.site"
export MY_NOTION_API_TOKEN="mnt_xxx"
```

`MY_NOTION_API_TOKEN` is a legacy/CI escape hatch. Prefer browser authorization for Agent workflows.

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

- Never ask users to paste full PAT tokens into chat. Prefer browser authorization links.
- Never paste `device_code` into chats or logs; it is a temporary credential held by the CLI for polling.
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
