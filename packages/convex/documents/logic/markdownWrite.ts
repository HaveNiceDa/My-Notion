import { mutation } from "@convex/server";
import { v } from "convex/values";
import {
  appendMarkdownToBlockNoteJson,
  blockNoteJsonToMarkdown,
  markdownToBlockNoteJson,
} from "./markdown";

const updateModeValidator = v.union(v.literal("overwrite"), v.literal("append"));

function toDocumentWriteResult(document: {
  _id: string;
  title: string;
  content?: string;
  isArchived?: boolean;
  isPublished: boolean;
  isInKnowledgeBase?: boolean;
  lastEditedTime?: number;
}) {
  return {
    id: document._id,
    title: document.title,
    content: document.content ?? "",
    contentMarkdown: blockNoteJsonToMarkdown(document.content),
    contentFormat: "blocknote-json" as const,
    isArchived: Boolean(document.isArchived),
    isPublished: document.isPublished,
    isInKnowledgeBase: Boolean(document.isInKnowledgeBase),
    lastEditedTime: document.lastEditedTime ?? null,
  };
}

export const createFromMarkdown = mutation({
  args: {
    title: v.string(),
    contentMarkdown: v.optional(v.string()),
    parentDocument: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const title = args.title.trim();
    if (!title) {
      throw new Error("title is required");
    }

    const parentDocument = args.parentDocument
      ? ctx.db.normalizeId("documents", args.parentDocument)
      : undefined;
    if (args.parentDocument && !parentDocument) {
      throw new Error("Invalid parentDocument");
    }

    const now = Date.now();
    const documentId = await ctx.db.insert("documents", {
      title,
      parentDocument: parentDocument ?? undefined,
      userId: identity.subject,
      content: args.contentMarkdown ? markdownToBlockNoteJson(args.contentMarkdown) : undefined,
      isArchived: false,
      isPublished: false,
      isStarred: false,
      isInKnowledgeBase: true,
      lastEditedTime: now,
    });

    const document = await ctx.db.get(documentId);
    if (!document) {
      throw new Error("Failed to create document");
    }

    return toDocumentWriteResult(document);
  },
});

export const updateFromMarkdown = mutation({
  args: {
    documentId: v.string(),
    title: v.optional(v.string()),
    contentMarkdown: v.optional(v.string()),
    mode: v.optional(updateModeValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const documentId = ctx.db.normalizeId("documents", args.documentId);
    if (!documentId) {
      throw new Error("Invalid documentId");
    }

    const document = await ctx.db.get(documentId);
    if (!document || document.isArchived || document.userId !== identity.subject) {
      throw new Error("Document not found");
    }

    const patch: {
      title?: string;
      content?: string;
      lastEditedTime: number;
    } = {
      lastEditedTime: Date.now(),
    };

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) {
        throw new Error("title cannot be empty");
      }
      patch.title = title;
    }

    if (args.contentMarkdown !== undefined) {
      const mode = args.mode ?? "append";
      patch.content =
        mode === "append"
          ? appendMarkdownToBlockNoteJson(document.content, args.contentMarkdown)
          : markdownToBlockNoteJson(args.contentMarkdown);
    }

    await ctx.db.patch(documentId, patch);
    const updatedDocument = await ctx.db.get(documentId);
    if (!updatedDocument) {
      throw new Error("Failed to update document");
    }

    return toDocumentWriteResult(updatedDocument);
  },
});
