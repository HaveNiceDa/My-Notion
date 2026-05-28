import { v } from "convex/values";
import { query } from "@convex/server";
import type { Doc } from "@convex/dataModel";

type DocumentDoc = Doc<"documents">;

function toTimestamp(document: DocumentDoc): number {
  return document.lastEditedTime ?? document._creationTime;
}

/**
 * 文档元数据搜索：按标题/路径/最近编辑检索文档，不读取文档正文。
 */
export const searchMetadata = query({
  args: {
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
    updatedAfter: v.optional(v.number()),
  },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const queryText = args.query?.trim().toLowerCase();
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 10), 1), 30);

    const documents = await context.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        args.includeArchived
          ? q.eq(q.field("userId"), userId)
          : q.eq(q.field("isArchived"), false),
      )
      .order("desc")
      .take(500);

    const documentMap = new Map(documents.map((document) => [document._id, document]));
    const results = documents
      .map((document) => {
        const path = buildPath(document, documentMap);
        const pathText = path.join(" / ").toLowerCase();
        const titleText = document.title.toLowerCase();
        const updatedAt = toTimestamp(document);
        const matchesQuery = !queryText || titleText.includes(queryText) || pathText.includes(queryText);
        const matchesUpdatedAfter = !args.updatedAfter || updatedAt >= args.updatedAfter;
        if (!matchesQuery || !matchesUpdatedAfter) return null;

        return {
          documentId: document._id,
          title: document.title,
          path,
          parentDocument: document.parentDocument,
          isArchived: document.isArchived,
          isStarred: Boolean(document.isStarred),
          isInKnowledgeBase: Boolean(document.isInKnowledgeBase),
          updatedAt,
          createdAt: document._creationTime,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);

    return {
      query: args.query,
      documents: results,
      metadata: {
        count: results.length,
        searchedCount: documents.length,
        includeArchived: Boolean(args.includeArchived),
        updatedAfter: args.updatedAfter,
      },
    };
  },
});

function buildPath(document: DocumentDoc, documentMap: Map<string, DocumentDoc>): string[] {
  const path: string[] = [document.title];
  const seen = new Set<string>([document._id]);
  let current = document;

  while (current.parentDocument) {
    const parentId = current.parentDocument;
    if (seen.has(parentId)) break;
    const parent = documentMap.get(parentId);
    if (!parent) break;
    path.unshift(parent.title);
    seen.add(parentId);
    current = parent;
  }

  return path;
}
