import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MyNotionApiError, MyNotionClient } from "../client/http-client.js";
import { resolveApiUrl, resolveToken } from "../config/store.js";
import type { DocumentResult, ParsedArgs, WhiteboardResult } from "../types.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

function createClient(args: ParsedArgs) {
  return new MyNotionClient({
    apiUrl: resolveApiUrl(args.options),
    token: resolveToken(args.options),
  });
}

function toToolResult(data: Record<string, unknown>, message?: string): ToolResult {
  return {
    structuredContent: data,
    // 兼容只展示 text content 的 MCP 客户端，保留可读说明和 JSON 兜底。
    content: [
      {
        type: "text",
        text: [message, JSON.stringify(data, null, 2)].filter(Boolean).join("\n\n"),
      },
    ],
  };
}

function toErrorToolResult(error: unknown, action: string): ToolResult {
  const apiError = error instanceof MyNotionApiError ? error : null;
  const message = error instanceof Error ? error.message : String(error);
  const structured = {
    action,
    error: {
      message,
      name: error instanceof Error ? error.name : "Error",
      status: apiError?.status,
      code: apiError?.code,
      requestId: apiError?.requestId,
    },
  };

  return {
    isError: true,
    structuredContent: structured,
    content: [
      {
        type: "text",
        text: [
          `My-Notion MCP tool failed during ${action}.`,
          apiError?.code ? `Error code: ${apiError.code}` : undefined,
          apiError?.requestId ? `Request ID: ${apiError.requestId}` : undefined,
          `Message: ${message}`,
          JSON.stringify(structured, null, 2),
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  };
}

function toDocumentContent(document: DocumentResult) {
  return {
    document,
    markdown: document.contentMarkdown,
    inputFormat: "markdown",
    contentFormat: document.contentFormat,
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

function createDryRunWhiteboard(input: {
  title: string;
  documentId?: string;
  dsl?: unknown;
}): WhiteboardResult {
  const now = Date.now();
  return {
    id: "dry-run",
    title: input.title,
    documentId: input.documentId,
    engine: "excalidraw",
    sceneJson: JSON.stringify({ dryRun: true, dsl: input.dsl ?? null }, null, 2),
    sourceDsl: input.dsl ? JSON.stringify(input.dsl, null, 2) : undefined,
    sourceDslVersion: "mwb-dsl-v1",
    isArchived: false,
    createdAt: now,
    updatedAt: now,
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
      try {
        const result = await client.searchDocuments({ query, limit });
        return toToolResult({ documents: result.documents });
      } catch (error) {
        return toErrorToolResult(error, "search");
      }
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
      try {
        const document = await client.fetchDocument(id);
        return toToolResult(toDocumentContent(document));
      } catch (error) {
        return toErrorToolResult(error, "fetch");
      }
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
      try {
        if (dryRun) {
          const message =
            "Dry run only. No My-Notion document was created. Set dryRun=false only after explicit user approval.";
          // 写入类工具默认 dry-run，客户端必须在用户明确授权后才关闭 dry-run。
          return toToolResult(
            {
              dryRun: true,
              action: "create",
              confirmationRequired: true,
              targetFormat: "blocknote-json",
              message,
              ...toDocumentContent(createDryRunDocument({ title, contentMarkdown })),
            },
            message,
          );
        }

        const document = await client.createDocument({ title, contentMarkdown });
        return toToolResult(
          {
            dryRun: false,
            action: "create",
            targetFormat: "blocknote-json",
            message: "Document created in My-Notion.",
            ...toDocumentContent(document),
          },
          "Document created in My-Notion.",
        );
      } catch (error) {
        return toErrorToolResult(error, "create");
      }
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
      try {
        if (dryRun) {
          const message =
            "Dry run only. No My-Notion document was updated. Set dryRun=false only after explicit user approval.";
          // update 的 dry-run 只回显计划变更，不读取或写入真实文档。
          return toToolResult(
            {
              dryRun: true,
              action: "update",
              confirmationRequired: true,
              inputFormat: "markdown",
              targetFormat: "blocknote-json",
              message,
              update: {
                id,
                title,
                contentMarkdown,
                mode,
              },
            },
            message,
          );
        }

        const document = await client.updateDocument({
          id,
          title,
          contentMarkdown,
          mode,
        });
        return toToolResult(
          {
            dryRun: false,
            action: "update",
            targetFormat: "blocknote-json",
            message: "Document updated in My-Notion.",
            ...toDocumentContent(document),
          },
          "Document updated in My-Notion.",
        );
      } catch (error) {
        return toErrorToolResult(error, "update");
      }
    },
  );
}

function registerWhiteboardTools(server: McpServer, client: MyNotionClient) {
  server.registerTool(
    "my_notion_whiteboards_list",
    {
      title: "列出 My-Notion 画板",
      description: "列出当前 PAT 用户的画板，可按文档 ID 过滤。",
      inputSchema: {
        documentId: z.string().optional().describe("可选，关联的 My-Notion 文档 ID。"),
        limit: z.number().int().min(1).max(50).optional().describe("最多返回的画板数量。"),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ documentId, limit }) => {
      try {
        const result = await client.listWhiteboards({ documentId, limit });
        return toToolResult({ whiteboards: result.whiteboards });
      } catch (error) {
        return toErrorToolResult(error, "whiteboard_list");
      }
    },
  );

  server.registerTool(
    "my_notion_whiteboards_read",
    {
      title: "读取 My-Notion 画板",
      description: "按画板 ID 读取 Excalidraw sceneJson、DSL 来源和元数据。",
      inputSchema: {
        id: z.string().min(1).describe("My-Notion 画板 ID。"),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ id }) => {
      try {
        const whiteboard = await client.fetchWhiteboard(id);
        return toToolResult({ whiteboard });
      } catch (error) {
        return toErrorToolResult(error, "whiteboard_read");
      }
    },
  );

  server.registerTool(
    "my_notion_whiteboards_create",
    {
      title: "创建 My-Notion 画板",
      description: "使用 mwb-dsl-v1 DSL 创建 Excalidraw 画板；默认 dry-run，真实写入前必须获得用户确认。",
      inputSchema: {
        title: z.string().min(1).describe("画板标题。"),
        documentId: z.string().optional().describe("可选，关联的 My-Notion 文档 ID。"),
        dsl: z.record(z.unknown()).optional().describe("mwb-dsl-v1 画板 DSL 对象。"),
        dryRun: z.boolean().default(true).describe("为 true 时只预览，不创建真实画板。"),
      },
      annotations: {
        destructiveHint: false,
        readOnlyHint: false,
      },
    },
    async ({ title, documentId, dsl, dryRun }) => {
      try {
        if (dryRun) {
          const message =
            "Dry run only. No My-Notion whiteboard was created. Set dryRun=false only after explicit user approval.";
          return toToolResult(
            {
              dryRun: true,
              action: "whiteboard_create",
              confirmationRequired: true,
              targetFormat: "excalidraw",
              message,
              whiteboard: createDryRunWhiteboard({ title, documentId, dsl }),
            },
            message,
          );
        }
        const whiteboard = await client.createWhiteboard({ title, documentId, dsl });
        return toToolResult(
          {
            dryRun: false,
            action: "whiteboard_create",
            targetFormat: "excalidraw",
            whiteboard,
          },
          "Whiteboard created in My-Notion.",
        );
      } catch (error) {
        return toErrorToolResult(error, "whiteboard_create");
      }
    },
  );

  server.registerTool(
    "my_notion_whiteboards_update",
    {
      title: "更新 My-Notion 画板",
      description: "使用 mwb-dsl-v1 DSL 更新 Excalidraw 画板；默认 dry-run，真实写入前必须获得用户确认。",
      inputSchema: {
        id: z.string().min(1).describe("My-Notion 画板 ID。"),
        title: z.string().optional().describe("可选的新标题。"),
        dsl: z.record(z.unknown()).optional().describe("mwb-dsl-v1 画板 DSL 对象。"),
        dryRun: z.boolean().default(true).describe("为 true 时只预览，不修改真实画板。"),
      },
      annotations: {
        destructiveHint: true,
        readOnlyHint: false,
      },
    },
    async ({ id, title, dsl, dryRun }) => {
      try {
        if (dryRun) {
          const message =
            "Dry run only. No My-Notion whiteboard was updated. Set dryRun=false only after explicit user approval.";
          return toToolResult(
            {
              dryRun: true,
              action: "whiteboard_update",
              confirmationRequired: true,
              targetFormat: "excalidraw",
              update: { id, title, dsl },
              message,
            },
            message,
          );
        }
        const whiteboard = await client.updateWhiteboard({ id, title, dsl });
        return toToolResult(
          {
            dryRun: false,
            action: "whiteboard_update",
            targetFormat: "excalidraw",
            whiteboard,
          },
          "Whiteboard updated in My-Notion.",
        );
      } catch (error) {
        return toErrorToolResult(error, "whiteboard_update");
      }
    },
  );

  server.registerTool(
    "my_notion_whiteboards_export",
    {
      title: "导出 My-Notion 画板",
      description: "导出画板为 scene JSON、SVG 占位预览或包含 scene/thumbnail/svg 的 package。",
      inputSchema: {
        id: z.string().min(1).describe("My-Notion 画板 ID。"),
        format: z.enum(["json", "svg", "package"]).default("json").describe("导出格式。"),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ id, format }) => {
      try {
        const exported = await client.exportWhiteboard({ id, format });
        return toToolResult({ export: exported });
      } catch (error) {
        return toErrorToolResult(error, "whiteboard_export");
      }
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
  registerWhiteboardTools(server, client);

  // MVP 阶段只支持 STDIO transport；HTTP/OAuth 后续单独设计，避免混淆鉴权边界。
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
