import { api } from "../../../../convex/_generated/api";
import type { ToolContext } from "./types";

export async function executeDocumentSearch(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  if (!context.convex) {
    return { documents: [], error: "Convex client is not available", recoverable: true };
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
    return await context.convex.query(api.documents.searchMetadata, {
      query,
      limit,
      includeArchived,
      updatedAfter,
    });
  } catch (error) {
    return {
      query,
      documents: [],
      error: error instanceof Error ? error.message : String(error),
      recoverable: true,
    };
  }
}
