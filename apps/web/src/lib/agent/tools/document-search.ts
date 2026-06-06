import { api } from "../../../../convex/_generated/api";
import { buildToolErrorResult, withToolResultContract } from "./result-contract";
import type { ToolContext } from "./types";

export async function executeDocumentSearch(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  if (!context.convex) {
    return {
      documents: [],
      ...buildToolErrorResult("document_search", "Convex client is not available", { reason: "unavailable" }),
    };
  }

  const query = typeof args.query === "string" && args.query.trim()
    ? args.query.trim()
    : undefined;
  const limit = typeof args.limit === "number"
    ? Math.min(Math.max(Math.floor(args.limit), 1), 30)
    : 10;
  const includeArchived = args.includeArchived === true;
  const updatedAfter = typeof args.updatedAfter === "number" && Number.isFinite(args.updatedAfter)
    ? args.updatedAfter
    : undefined;

  try {
    const result = await context.convex.query(api.documents.searchMetadata, {
      query,
      limit,
      includeArchived,
      updatedAfter,
    });
    const documents = Array.isArray(result.documents) ? result.documents : [];
    return withToolResultContract("document_search", result, {
      summary: `Found ${documents.length} document(s).`,
      sources: documents.map((document) => ({
        type: "document",
        documentId: document.documentId,
        title: document.title,
      })),
      metadata: {
        query,
        limit,
        includeArchived,
        updatedAfter,
        count: documents.length,
      },
    });
  } catch (error) {
    return {
      query,
      documents: [],
      ...buildToolErrorResult("document_search", error),
    };
  }
}
