import { myNotionToolManifest } from "./manifest.js";
import { toErrorToolResult, toToolResult } from "../results/tool-result.js";
import type { AgentToolContext, DocumentResult } from "../types.js";

export type SearchDocumentsInput = {
  query?: string;
  limit?: number;
};

export type FetchDocumentInput = {
  id: string;
};

export type CreateDocumentInput = {
  title: string;
  contentMarkdown?: string;
  dryRun?: boolean;
};

export type UpdateDocumentInput = {
  id: string;
  title?: string;
  contentMarkdown?: string;
  mode?: "append" | "overwrite";
  dryRun?: boolean;
};

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

function normalizeLimit(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(Math.floor(value), 1), 50)
    : undefined;
}

export async function searchDocumentsTool(
  input: SearchDocumentsInput,
  context: AgentToolContext,
) {
  try {
    const result = await context.client.searchDocuments({
      query: typeof input.query === "string" && input.query.trim() ? input.query.trim() : undefined,
      limit: normalizeLimit(input.limit),
    });
    return toToolResult({ documents: result.documents });
  } catch (error) {
    return toErrorToolResult(error, "search");
  }
}

export async function fetchDocumentTool(
  input: FetchDocumentInput,
  context: AgentToolContext,
) {
  try {
    const document = await context.client.fetchDocument(input.id);
    return toToolResult(toDocumentContent(document));
  } catch (error) {
    return toErrorToolResult(error, "fetch");
  }
}

export async function createDocumentTool(
  input: CreateDocumentInput,
  context: AgentToolContext,
) {
  try {
    const dryRun = input.dryRun ?? true;
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
          ...toDocumentContent(createDryRunDocument({
            title: input.title,
            contentMarkdown: input.contentMarkdown,
          })),
        },
        message,
      );
    }

    const document = await context.client.createDocument({
      title: input.title,
      contentMarkdown: input.contentMarkdown,
    });
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
}

export async function updateDocumentTool(
  input: UpdateDocumentInput,
  context: AgentToolContext,
) {
  try {
    const dryRun = input.dryRun ?? true;
    const mode = input.mode === "overwrite" ? "overwrite" : "append";
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
            id: input.id,
            title: input.title,
            contentMarkdown: input.contentMarkdown,
            mode,
          },
        },
        message,
      );
    }

    const document = await context.client.updateDocument({
      id: input.id,
      title: input.title,
      contentMarkdown: input.contentMarkdown,
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
}

export function getToolManifest() {
  return myNotionToolManifest;
}
