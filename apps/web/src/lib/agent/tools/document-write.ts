import type { ToolContext } from "./types";
import { buildToolErrorResult, withToolResultContract } from "./result-contract";

type DocumentWriteAction = "document_write" | "document_update";
type DocumentUpdateMode = "overwrite" | "append";

const UPDATE_MODES = new Set<DocumentUpdateMode>(["overwrite", "append"]);

interface DocumentWritePreview {
  title: string;
  contentMarkdown: string;
  parentDocument?: string;
}

interface DocumentUpdatePreview {
  documentId: string;
  title?: string;
  contentMarkdown?: string;
  mode: DocumentUpdateMode;
}

export async function executeDocumentWrite(
  args: Record<string, unknown>,
  _context: ToolContext,
): Promise<unknown> {
  const preview = buildWritePreview(args);
  if (!preview.title) {
    return buildToolErrorResult("document_write", "title is required", { reason: "validation_error" });
  }
  if (!preview.contentMarkdown) {
    return buildToolErrorResult("document_write", "contentMarkdown is required", { reason: "validation_error" });
  }

  return buildDryRunResult("document_write", {
    document: preview,
    summary: `Create document "${preview.title}" from Markdown.`,
  });
}

export async function executeDocumentUpdate(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  const preview = buildUpdatePreview(args, context);
  if (!preview.documentId) {
    return buildToolErrorResult("document_update", "documentId is required", { reason: "validation_error" });
  }
  if (!preview.title && !preview.contentMarkdown) {
    return buildToolErrorResult("document_update", "title or contentMarkdown is required", { reason: "validation_error" });
  }

  const targetTitle = context.currentDocument?.id === preview.documentId
    ? context.currentDocument.title
    : undefined;
  const summaryParts = [
    preview.title ? `rename to "${preview.title}"` : null,
    preview.contentMarkdown ? `${preview.mode} Markdown content` : null,
  ].filter(Boolean);

  return buildDryRunResult("document_update", {
    document: {
      ...preview,
      currentTitle: targetTitle,
    },
    summary: `Update document ${targetTitle ? `"${targetTitle}"` : preview.documentId}: ${summaryParts.join(", ")}.`,
  });
}

function buildDryRunResult(
  action: DocumentWriteAction,
  payload: {
    document: DocumentWritePreview | (DocumentUpdatePreview & { currentTitle?: string });
    summary: string;
  },
) {
  return withToolResultContract(action, {
    dryRun: true,
    confirmationRequired: true,
    action,
    message:
      "Dry run only. No document was changed. Confirm in the UI before applying this write.",
    document: payload.document,
  }, {
    summary: payload.summary,
    sources: [],
    metadata: {
      recoverable: true,
      writeContract: "preview_then_confirm",
      inputFormat: "markdown",
      targetFormat: "blocknote-json",
    },
  });
}

function buildWritePreview(args: Record<string, unknown>): DocumentWritePreview {
  return {
    title: typeof args.title === "string" ? args.title.trim() : "",
    contentMarkdown: typeof args.contentMarkdown === "string" ? args.contentMarkdown.trim() : "",
    parentDocument: typeof args.parentDocument === "string" && args.parentDocument.trim()
      ? args.parentDocument.trim()
      : undefined,
  };
}

function buildUpdatePreview(
  args: Record<string, unknown>,
  context: ToolContext,
): DocumentUpdatePreview {
  return {
    documentId: typeof args.documentId === "string" && args.documentId.trim()
      ? args.documentId.trim()
      : context.currentDocument?.id ?? "",
    title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : undefined,
    contentMarkdown: typeof args.contentMarkdown === "string" && args.contentMarkdown.trim()
      ? args.contentMarkdown.trim()
      : undefined,
    mode: parseUpdateMode(args.mode),
  };
}

function parseUpdateMode(value: unknown): DocumentUpdateMode {
  return typeof value === "string" && UPDATE_MODES.has(value as DocumentUpdateMode)
    ? value as DocumentUpdateMode
    : "append";
}
