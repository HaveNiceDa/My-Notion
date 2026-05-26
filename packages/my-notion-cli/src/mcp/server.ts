import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MyNotionClient } from "../client/http-client.js";
import { resolveApiUrl, resolveToken } from "../config/store.js";
import type { DocumentResult, ParsedArgs } from "../types.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
};

function createClient(args: ParsedArgs) {
  return new MyNotionClient({
    apiUrl: resolveApiUrl(args.options),
    token: resolveToken(args.options),
  });
}

function toToolResult(data: Record<string, unknown>): ToolResult {
  return {
    structuredContent: data,
    // 兼容只展示 text content 的 MCP 客户端，保留一份 JSON 文本兜底。
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function toDocumentContent(document: DocumentResult) {
  return {
    document,
    markdown: document.contentMarkdown,
  };
}

function createDryRunDocument(input: {
  title: string;
  contentMarkdown?: string;
}): DocumentResult {
  const now = Date.now();
  // dry-run 不能触发真实 API，只返回一个形似文档的预览结果。
  return {
    id: "dry-run",
    title: input.title,
    content: input.contentMarkdown ?? "",
    contentMarkdown: input.contentMarkdown ?? "",
    contentFormat: "markdown",
    isArchived: false,
    isPublished: false,
    isInKnowledgeBase: true,
    lastEditedTime: now,
  };
}

function registerDocumentTools(server: McpServer, client: MyNotionClient) {
  // 只读工具必须无副作用，MCP 客户端可以在无需用户确认时安全调用。
  // my_notion_docs_search：按关键词搜索当前 PAT 用户的文档，返回文档列表。
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
    async ({ query, limit }) => {
      const result = await client.searchDocuments({ query, limit });
      return toToolResult({ documents: result.documents });
    },
  );

  // my_notion_docs_fetch：按文档 ID 读取单篇文档，返回结构化元信息和 Markdown 正文。
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
    async ({ id }) => {
      const document = await client.fetchDocument(id);
      return toToolResult(toDocumentContent(document));
    },
  );

  // my_notion_docs_create：从 Markdown 创建新文档，默认 dry-run，显式授权后才真实写入。
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
    async ({ title, contentMarkdown, dryRun }) => {
      if (dryRun) {
        // 写入类工具默认 dry-run，客户端必须在用户明确授权后才关闭 dry-run。
        return toToolResult({
          dryRun: true,
          action: "create",
          ...toDocumentContent(createDryRunDocument({ title, contentMarkdown })),
        });
      }

      const document = await client.createDocument({ title, contentMarkdown });
      return toToolResult({
        dryRun: false,
        action: "create",
        ...toDocumentContent(document),
      });
    },
  );

  // my_notion_docs_update：更新标题或正文，支持 append/overwrite，默认 dry-run 防止误覆盖。
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
    async ({ id, title, contentMarkdown, mode, dryRun }) => {
      if (dryRun) {
        // update 的 dry-run 只回显计划变更，不读取或写入真实文档。
        return toToolResult({
          dryRun: true,
          action: "update",
          update: {
            id,
            title,
            contentMarkdown,
            mode,
          },
        });
      }

      const document = await client.updateDocument({
        id,
        title,
        contentMarkdown,
        mode,
      });
      return toToolResult({
        dryRun: false,
        action: "update",
        ...toDocumentContent(document),
      });
    },
  );
}

export async function runMcpStdioServer(args: ParsedArgs) {
  const client = createClient(args);
  const server = new McpServer({
    name: "my-notion",
    version: "0.1.0",
  });

  registerDocumentTools(server, client);

  // MVP 阶段只支持 STDIO transport；HTTP/OAuth 后续单独设计，避免混淆鉴权边界。
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
