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
    // Some MCP clients still surface only text content, so keep a JSON fallback.
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
  // Dry-run must not touch the API; return a document-shaped preview for clients.
  return {
    id: "dry-run",
    title: input.title,
    content: input.contentMarkdown ?? "",
    contentMarkdown: input.contentMarkdown ?? "",
    contentFormat: "markdown",
    isPublished: false,
    isInKnowledgeBase: true,
    lastEditedTime: now,
  };
}

function registerDocumentTools(server: McpServer, client: MyNotionClient) {
  // Keep read tools side-effect free so MCP clients can call them without approval.
  server.registerTool(
    "my_notion_docs_search",
    {
      title: "Search My-Notion Documents",
      description: "Search the current My-Notion user's documents by keyword.",
      inputSchema: {
        query: z.string().optional().describe("Search keyword. Omit to list recent documents."),
        limit: z.number().int().min(1).max(50).optional().describe("Maximum documents to return."),
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

  server.registerTool(
    "my_notion_docs_fetch",
    {
      title: "Fetch My-Notion Document",
      description: "Fetch a document by id and return both structured metadata and Markdown content.",
      inputSchema: {
        id: z.string().min(1).describe("My-Notion document id."),
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

  server.registerTool(
    "my_notion_docs_create",
    {
      title: "Create My-Notion Document",
      description: "Create a My-Notion document from Markdown. Use dryRun first unless the user approved writing.",
      inputSchema: {
        title: z.string().min(1).describe("Document title."),
        contentMarkdown: z.string().optional().describe("Markdown content to write."),
        dryRun: z
          .boolean()
          .default(true)
          .describe("When true, validate and preview without creating a document."),
      },
      annotations: {
        destructiveHint: false,
        readOnlyHint: false,
      },
    },
    async ({ title, contentMarkdown, dryRun }) => {
      if (dryRun) {
        // Write tools default to dry-run; clients must opt in with explicit approval.
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

  server.registerTool(
    "my_notion_docs_update",
    {
      title: "Update My-Notion Document",
      description: "Update a document title/content. Use dryRun first before append or overwrite writes.",
      inputSchema: {
        id: z.string().min(1).describe("My-Notion document id."),
        title: z.string().optional().describe("Optional new document title."),
        contentMarkdown: z.string().optional().describe("Markdown content to append or overwrite."),
        mode: z.enum(["append", "overwrite"]).default("append").describe("Content update mode."),
        dryRun: z
          .boolean()
          .default(true)
          .describe("When true, preview the intended update without changing the document."),
      },
      annotations: {
        destructiveHint: true,
        readOnlyHint: false,
      },
    },
    async ({ id, title, contentMarkdown, mode, dryRun }) => {
      if (dryRun) {
        // For updates, dry-run echoes the intended mutation instead of fetching/writing.
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

  // STDIO is the only supported transport for the MVP; HTTP/OAuth are future work.
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
