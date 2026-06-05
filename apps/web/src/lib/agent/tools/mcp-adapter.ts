import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { executeDocumentUpdate, executeDocumentWrite } from "./document-write";
import { buildToolMetadata, mergeToolMetadata } from "./result-contract";
import type { ToolContext } from "./types";

type MyNotionMcpToolName =
  | "my_notion_docs_search"
  | "my_notion_docs_fetch"
  | "my_notion_docs_create"
  | "my_notion_docs_update";

const ALLOWED_TOOLS = new Set<MyNotionMcpToolName>([
  "my_notion_docs_search",
  "my_notion_docs_fetch",
  "my_notion_docs_create",
  "my_notion_docs_update",
]);

interface DocumentRecord {
  _id: string;
  title?: string;
  content?: string;
  isArchived?: boolean;
  isPublished?: boolean;
  isInKnowledgeBase?: boolean;
  lastEditedTime?: number;
}

interface McpMetadata {
  toolName: string;
  contractVersion: "tool-result-v1";
  adapter: "my-notion-mcp";
  mcpToolName: MyNotionMcpToolName;
  transport: "in_process";
  safety: "read_only" | "dry_run_only";
}

export async function executeMyNotionMcpAdapter(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  const toolName = parseToolName(args.toolName);
  if (!toolName) {
    return buildMcpError("mcp_my_notion_call", "toolName must be one of the allowed My-Notion MCP tools.");
  }

  const input = isRecord(args.input) ? args.input : {};
  switch (toolName) {
    case "my_notion_docs_search":
      return executeDocsSearch(input, context, toolName);
    case "my_notion_docs_fetch":
      return executeDocsFetch(input, context, toolName);
    case "my_notion_docs_create":
      return executeDocsCreate(input, context, toolName);
    case "my_notion_docs_update":
      return executeDocsUpdate(input, context, toolName);
  }
}

async function executeDocsSearch(
  input: Record<string, unknown>,
  context: ToolContext,
  toolName: MyNotionMcpToolName,
): Promise<unknown> {
  if (!context.convex) {
    return buildMcpError(toolName, "Convex client is not available.");
  }

  const query = typeof input.query === "string" && input.query.trim()
    ? input.query.trim()
    : undefined;
  const limit = clampNumber(input.limit, 1, 50, 10);
  const result = await context.convex.query(api.documents.searchMetadata, {
    query,
    limit: Math.min(limit, 30),
    includeArchived: false,
  });
  const documents = Array.isArray(result.documents)
    ? result.documents.map((document) => ({
      ...document,
      id: document.documentId,
    }))
    : [];

  return {
    toolName,
    adapter: "my-notion-mcp",
    summary: `MCP docs search returned ${documents.length} document(s).`,
    documents,
    metadata: buildMetadata(toolName, "read_only"),
  };
}

async function executeDocsFetch(
  input: Record<string, unknown>,
  context: ToolContext,
  toolName: MyNotionMcpToolName,
): Promise<unknown> {
  if (!context.convex) {
    return buildMcpError(toolName, "Convex client is not available.");
  }

  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id) {
    return buildMcpError(toolName, "id is required.");
  }

  const document = await context.convex.query(api.documents.getById, {
    documentId: id as Id<"documents">,
  }) as DocumentRecord;
  const markdown = blockNoteJsonToMarkdown(document.content);

  return {
    toolName,
    adapter: "my-notion-mcp",
    summary: `Fetched document "${document.title ?? "Untitled"}" through the controlled MCP adapter.`,
    document: {
      id: document._id,
      title: document.title ?? "Untitled",
      isArchived: Boolean(document.isArchived),
      isPublished: Boolean(document.isPublished),
      isInKnowledgeBase: Boolean(document.isInKnowledgeBase),
      lastEditedTime: document.lastEditedTime,
    },
    markdown,
    inputFormat: "markdown",
    contentFormat: "blocknote-json",
    metadata: buildMetadata(toolName, "read_only"),
  };
}

async function executeDocsCreate(
  input: Record<string, unknown>,
  context: ToolContext,
  toolName: MyNotionMcpToolName,
): Promise<unknown> {
  const result = await executeDocumentWrite(
    {
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      dryRun: true,
    },
    context,
  );
  return attachMcpMetadata(result, toolName, "dry_run_only");
}

async function executeDocsUpdate(
  input: Record<string, unknown>,
  context: ToolContext,
  toolName: MyNotionMcpToolName,
): Promise<unknown> {
  const result = await executeDocumentUpdate(
    {
      documentId: input.id,
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      mode: input.mode,
      dryRun: true,
    },
    context,
  );
  return attachMcpMetadata(result, toolName, "dry_run_only");
}

function parseToolName(value: unknown): MyNotionMcpToolName | null {
  return typeof value === "string" && ALLOWED_TOOLS.has(value as MyNotionMcpToolName)
    ? value as MyNotionMcpToolName
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.floor(value), min), max);
}

function buildMetadata(toolName: MyNotionMcpToolName, safety: McpMetadata["safety"]): McpMetadata {
  return {
    ...buildToolMetadata("mcp_my_notion_call"),
    adapter: "my-notion-mcp",
    mcpToolName: toolName,
    transport: "in_process",
    safety,
  };
}

function attachMcpMetadata(
  result: unknown,
  toolName: MyNotionMcpToolName,
  safety: McpMetadata["safety"],
): unknown {
  if (!isRecord(result)) return result;
  return {
    ...result,
    toolName,
    adapter: "my-notion-mcp",
    metadata: mergeToolMetadata("mcp_my_notion_call", result.metadata, {
      adapter: "my-notion-mcp",
      mcpToolName: toolName,
      transport: "in_process",
      safety,
    }),
  };
}

function buildMcpError(toolName: string, message: string) {
  return {
    toolName,
    adapter: "my-notion-mcp",
    error: message,
    summary: `${toolName} failed: ${message}`,
    recoverable: true,
    sources: [],
    metadata: buildToolMetadata("mcp_my_notion_call", {
      adapter: "my-notion-mcp",
      mcpToolName: toolName,
      reason: "validation_error",
    }),
  };
}

function blockNoteJsonToMarkdown(content?: string): string {
  if (!content) return "";

  try {
    const blocks = JSON.parse(content) as Array<{
      type?: string;
      props?: Record<string, unknown>;
      content?: string | Array<{ type?: string; text?: string; content?: Array<{ text?: string }>; href?: string }>;
    }>;
    if (!Array.isArray(blocks)) return content;
    return blocks
      .map((block, index) => blockToMarkdown(block, index))
      .filter((line) => line.trim().length > 0)
      .join("\n\n");
  } catch {
    return content;
  }
}

function blockToMarkdown(
  block: {
    type?: string;
    props?: Record<string, unknown>;
    content?: string | Array<{ type?: string; text?: string; content?: Array<{ text?: string }>; href?: string }>;
  },
  index: number,
): string {
  const text = inlineContentToText(block.content);
  switch (block.type) {
    case "heading": {
      const rawLevel = Number(block.props?.level ?? 1);
      const level = Math.min(Math.max(Number.isFinite(rawLevel) ? rawLevel : 1, 1), 6);
      return `${"#".repeat(level)} ${text}`;
    }
    case "bulletListItem":
      return `- ${text}`;
    case "numberedListItem":
      return `${index + 1}. ${text}`;
    case "checkListItem":
      return `- [${block.props?.checked ? "x" : " "}] ${text}`;
    case "quote":
      return text.split("\n").map((line) => `> ${line}`).join("\n");
    case "codeBlock":
      return `\`\`\`\n${text}\n\`\`\``;
    case "divider":
      return "---";
    case "whiteboard": {
      const title = typeof block.props?.title === "string" && block.props.title.trim()
        ? block.props.title.trim()
        : "Untitled whiteboard";
      const whiteboardId = typeof block.props?.whiteboardId === "string" ? block.props.whiteboardId : "unknown";
      return `![My-Notion Whiteboard: ${title}](mynotion-whiteboard://${whiteboardId})`;
    }
    default:
      return text;
  }
}

function inlineContentToText(
  content?: string | Array<{ type?: string; text?: string; content?: Array<{ text?: string }>; href?: string }>,
): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .map((part) => {
      if (part.type === "link") {
        const inner = inlineContentToText(part.content);
        return part.href ? `[${inner}](${part.href})` : inner;
      }
      return part.text ?? "";
    })
    .join("");
}
