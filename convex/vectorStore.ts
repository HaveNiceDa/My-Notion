import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const computeContentHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

export const getUserChunks = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documentChunks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getDocumentChunks = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documentChunks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("asc")
      .collect();
  },
});

export const getEmbeddingStatus = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documentEmbeddingStatus")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .first();
  },
});

export const needsReembedding = query({
  args: { documentId: v.id("documents"), contentHash: v.string() },
  handler: async (ctx, args) => {
    const status = await ctx.db
      .query("documentEmbeddingStatus")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .first();
    if (!status) {
      return true;
    }
    return status.contentHash !== args.contentHash;
  },
});

const internalDeleteDocumentChunks = async (
  ctx: any,
  documentId: Id<"documents">,
) => {
  const chunks = await ctx.db
    .query("documentChunks")
    .withIndex("by_document", (q: any) => q.eq("documentId", documentId))
    .collect();
  for (const chunk of chunks) {
    await ctx.db.delete(chunk._id);
  }
  return chunks.length;
};

const internalAddDocumentChunks = async (
  ctx: any,
  userId: string,
  documentId: Id<"documents">,
  chunks: any[],
) => {
  const now = Date.now();
  const insertedIds: Id<"documentChunks">[] = [];
  for (const chunk of chunks) {
    const contentHash = computeContentHash(chunk.pageContent);
    const id = await ctx.db.insert("documentChunks", {
      userId,
      documentId,
      chunkIndex: chunk.chunkIndex,
      embedding: chunk.embedding,
      pageContent: chunk.pageContent,
      metadata: chunk.metadata,
      contentHash,
      createdAt: now,
    });
    insertedIds.push(id);
  }
  return insertedIds;
};

const internalUpdateEmbeddingStatus = async (
  ctx: any,
  userId: string,
  documentId: Id<"documents">,
  status: "pending" | "processing" | "completed" | "failed",
  contentHash: string,
  errorMessage?: string,
) => {
  const now = Date.now();
  const existingStatus = await ctx.db
    .query("documentEmbeddingStatus")
    .withIndex("by_document", (q: any) => q.eq("documentId", documentId))
    .first();
  const statusData = {
    userId,
    documentId,
    lastEmbeddedTime: now,
    status,
    contentHash,
    errorMessage,
  };
  if (existingStatus) {
    await ctx.db.patch(existingStatus._id, statusData);
    return existingStatus._id;
  } else {
    return await ctx.db.insert("documentEmbeddingStatus", statusData);
  }
};

export const deleteDocumentChunks = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await internalDeleteDocumentChunks(ctx, args.documentId);
  },
});

export const addDocumentChunks = mutation({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
    chunks: v.array(
      v.object({
        chunkIndex: v.number(),
        embedding: v.array(v.number()),
        pageContent: v.string(),
        metadata: v.object({
          title: v.string(),
          documentId: v.string(),
        }),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return await internalAddDocumentChunks(
      ctx,
      args.userId,
      args.documentId,
      args.chunks,
    );
  },
});

export const updateEmbeddingStatus = mutation({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    contentHash: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await internalUpdateEmbeddingStatus(
      ctx,
      args.userId,
      args.documentId,
      args.status,
      args.contentHash,
      args.errorMessage,
    );
  },
});

export const embedDocument = mutation({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
    contentHash: v.string(),
    chunks: v.array(
      v.object({
        chunkIndex: v.number(),
        embedding: v.array(v.number()),
        pageContent: v.string(),
        metadata: v.object({
          title: v.string(),
          documentId: v.string(),
        }),
      }),
    ),
  },
  handler: async (ctx, args) => {
    try {
      await internalUpdateEmbeddingStatus(
        ctx,
        args.userId,
        args.documentId,
        "processing",
        args.contentHash,
      );
      await internalDeleteDocumentChunks(ctx, args.documentId);
      await internalAddDocumentChunks(
        ctx,
        args.userId,
        args.documentId,
        args.chunks,
      );
      await internalUpdateEmbeddingStatus(
        ctx,
        args.userId,
        args.documentId,
        "completed",
        args.contentHash,
      );
      return { success: true, chunkCount: args.chunks.length };
    } catch (error) {
      await internalUpdateEmbeddingStatus(
        ctx,
        args.userId,
        args.documentId,
        "failed",
        args.contentHash,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  },
});

export { computeContentHash };
