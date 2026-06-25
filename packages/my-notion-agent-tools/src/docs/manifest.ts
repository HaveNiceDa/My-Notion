import type { ToolManifestEntry } from "../types.js";

export const MY_NOTION_DOC_TOOL_NAMES = [
  "my_notion_readme",
  "my_notion_docs_search",
  "my_notion_docs_fetch",
  "my_notion_docs_create",
  "my_notion_docs_update",
] as const;

export type MyNotionToolName = typeof MY_NOTION_DOC_TOOL_NAMES[number];

export const myNotionToolManifest: ToolManifestEntry[] = [
  {
    name: "my_notion_readme",
    title: "My-Notion MCP 使用说明",
    description: "返回 My-Notion MCP server 的工具列表、认证方式、Markdown 契约和调用示例。",
    safety: "read_only",
    inputSchema: {},
    example: {},
  },
  {
    name: "my_notion_docs_search",
    title: "搜索 My-Notion 文档",
    description: "按关键词搜索当前 PAT 用户的 My-Notion 文档。",
    safety: "read_only",
    inputSchema: {
      query: "string? 搜索关键词；不传时按后端搜索接口默认行为返回。",
      limit: "number? 1-50，最多返回的文档数量。",
    },
    example: {
      query: "roadmap",
      limit: 10,
    },
  },
  {
    name: "my_notion_docs_fetch",
    title: "读取 My-Notion 文档",
    description: "按文档 ID 读取单篇文档，并返回结构化元信息和 Markdown 正文。",
    safety: "read_only",
    inputSchema: {
      id: "string 必填，My-Notion 文档 ID。",
    },
    example: {
      id: "j57...",
    },
  },
  {
    name: "my_notion_docs_create",
    title: "创建 My-Notion 文档",
    description: "使用 Markdown 创建新文档；除非用户已授权写入，否则应先使用 dryRun。",
    safety: "dry_run_default",
    inputSchema: {
      title: "string 必填，文档标题。",
      contentMarkdown: "string? 要写入的 Markdown 正文。",
      dryRun: "boolean? 默认 true，为 true 时只校验和预览，不创建真实文档。",
    },
    example: {
      title: "Project Plan",
      contentMarkdown: "# Project Plan\n\n...",
      dryRun: true,
    },
  },
  {
    name: "my_notion_docs_update",
    title: "更新 My-Notion 文档",
    description: "更新文档标题或正文；追加/覆盖写入前应先使用 dryRun 预览。",
    safety: "dry_run_default",
    inputSchema: {
      id: "string 必填，My-Notion 文档 ID。",
      title: "string? 可选的新文档标题。",
      contentMarkdown: "string? 要追加或覆盖的 Markdown 正文。",
      mode: "append|overwrite? 默认 append。",
      dryRun: "boolean? 默认 true，为 true 时只预览计划变更，不修改真实文档。",
    },
    example: {
      id: "j57...",
      contentMarkdown: "New section",
      mode: "append",
      dryRun: true,
    },
  },
];
