import {
  MyNotionClient,
  createDocumentTool,
  fetchDocumentTool,
  readmeTool,
  resolveProfile,
  searchDocumentsTool,
  toErrorToolResult,
  updateDocumentTool,
} from "@mynotion/agent-tools";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { toMcpToolResult } from "./result-adapter.js";

export type McpServerOptions = {
  options?: Record<string, string | boolean>;
};

function createContext(options: Record<string, string | boolean> = {}) {
  const profile = resolveProfile(options);
  if (!profile.token) {
    throw new Error(
      `Profile "${profile.name}" is not authenticated. Run \`${
        profile.local ? "my-notion auth login --local" : "my-notion auth login"
      }\`.`,
    );
  }

  return {
    client: new MyNotionClient({
      apiUrl: profile.apiUrl,
      token: profile.token,
    }),
  };
}

async function runWithContext(
  action: string,
  options: Record<string, string | boolean>,
  execute: (context: ReturnType<typeof createContext>) => Promise<ReturnType<typeof toMcpToolResult>>,
) {
  try {
    return await execute(createContext(options));
  } catch (error) {
    return toMcpToolResult(toErrorToolResult(error, action));
  }
}

export function registerMyNotionTools(
  server: McpServer,
  serverOptions: McpServerOptions = {},
) {
  const options = serverOptions.options ?? {};

  server.registerTool(
    "my_notion_readme",
    {
      title: "My-Notion MCP 使用说明",
      description: "返回 My-Notion MCP server 的工具列表、认证方式、Markdown 契约和调用示例。",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => toMcpToolResult(readmeTool(options)),
  );

  // 只读工具必须无副作用，MCP 客户端可以在无需用户确认时安全调用。
  server.registerTool(
    "my_notion_docs_search",
    {
      title: "搜索 My-Notion 文档",
      description: "按关键词搜索当前 PAT 用户的 My-Notion 文档。",
      inputSchema: {
        query: z.string().optional().describe("搜索关键词；不传时按后端搜索接口默认行为返回。"),
        limit: z.number().int().min(1).max(50).optional().describe("最多返回的文档数量。"),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ query, limit }) => runWithContext(
      "search",
      options,
      async (context) => toMcpToolResult(await searchDocumentsTool({ query, limit }, context)),
    ),
  );

  server.registerTool(
    "my_notion_docs_fetch",
    {
      title: "读取 My-Notion 文档",
      description: "按文档 ID 读取单篇文档，并返回结构化元信息和 Markdown 正文。",
      inputSchema: {
        id: z.string().min(1).describe("My-Notion 文档 ID。"),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ id }) => runWithContext(
      "fetch",
      options,
      async (context) => toMcpToolResult(await fetchDocumentTool({ id }, context)),
    ),
  );

  server.registerTool(
    "my_notion_docs_create",
    {
      title: "创建 My-Notion 文档",
      description: "使用 Markdown 创建新文档；除非用户已授权写入，否则应先使用 dryRun。",
      inputSchema: {
        title: z.string().min(1).describe("文档标题。"),
        contentMarkdown: z.string().optional().describe("要写入的 Markdown 正文。"),
        dryRun: z
          .boolean()
          .default(true)
          .describe("为 true 时只校验和预览，不创建真实文档。"),
      },
      annotations: {
        destructiveHint: false,
        readOnlyHint: false,
      },
    },
    async ({ title, contentMarkdown, dryRun }) => runWithContext(
      "create",
      options,
      async (context) => toMcpToolResult(await createDocumentTool({ title, contentMarkdown, dryRun }, context)),
    ),
  );

  server.registerTool(
    "my_notion_docs_update",
    {
      title: "更新 My-Notion 文档",
      description: "更新文档标题或正文；追加/覆盖写入前应先使用 dryRun 预览。",
      inputSchema: {
        id: z.string().min(1).describe("My-Notion 文档 ID。"),
        title: z.string().optional().describe("可选的新文档标题。"),
        contentMarkdown: z.string().optional().describe("要追加或覆盖的 Markdown 正文。"),
        mode: z.enum(["append", "overwrite"]).default("append").describe("正文更新模式。"),
        dryRun: z
          .boolean()
          .default(true)
          .describe("为 true 时只预览计划变更，不修改真实文档。"),
      },
      annotations: {
        destructiveHint: true,
        readOnlyHint: false,
      },
    },
    async ({ id, title, contentMarkdown, mode, dryRun }) => runWithContext(
      "update",
      options,
      async (context) => toMcpToolResult(await updateDocumentTool({ id, title, contentMarkdown, mode, dryRun }, context)),
    ),
  );
}
