# Changelog

## 0.1.0-beta.1

- Add `my-notion update` guidance for checking the installed CLI version and upgrade command.
- Add `my-notion config init` as the unified setup entry for environment checks, login guidance, Skills installation, and MCP startup hints.
- Improve CLI HTTP stability for Convex/Cloudflare endpoints by tuning Node auto-select-family timeout behavior.
- Support Markdown as the Agent-facing document format while the service layer handles BlockNote conversion.
- Expand MCP validation with a real SDK client end-to-end test covering tool discovery, dry-run writes, confirmed writes, fetch, update, search, and cleanup.

## 0.1.0-beta.0

- Publish beta package target as `@mynotion/cli` with `my-notion` binary.
- Support browser-based Device Flow login without asking users to paste full PAT tokens.
- Keep online `prod` and local `--local` login states isolated in separate config files.
- Provide document create, fetch, search, list, update, archive, import, and export commands.
- Provide MCP STDIO tools for document search, fetch, create, and update.
- Bundle My-Notion Agent Skills for CLI, docs, and MCP workflows.
- Add `my-notion install` guidance command for npm beta setup and Skills installation.
