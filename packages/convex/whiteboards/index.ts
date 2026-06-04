import { v } from "convex/values";
import { mutation, query } from "@convex/server";
import type { Id } from "@convex/dataModel";
import {
  createEmptyExcalidrawScene,
  parseWhiteboardDsl,
  stringifyWhiteboardScene,
  whiteboardDslToExcalidrawScene,
} from "@notion/business/whiteboard";
import type { WhiteboardDslDocument } from "@notion/business/whiteboard";

const dslNodeValidator = v.object({
  id: v.string(),
  type: v.union(
    v.literal("box"),
    v.literal("text"),
    v.literal("actor"),
    v.literal("database"),
    v.literal("note"),
    v.literal("diamond"),
    v.literal("frame"),
  ),
  text: v.string(),
  x: v.optional(v.number()),
  y: v.optional(v.number()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  backgroundColor: v.optional(v.string()),
  strokeColor: v.optional(v.string()),
});

const dslEdgeValidator = v.object({
  id: v.optional(v.string()),
  from: v.string(),
  to: v.string(),
  type: v.optional(v.union(v.literal("arrow"), v.literal("line"))),
  label: v.optional(v.string()),
});

const dslGroupValidator = v.object({
  id: v.string(),
  title: v.optional(v.string()),
  nodeIds: v.array(v.string()),
});

export const whiteboardDslValidator = v.object({
  version: v.literal("mwb-dsl-v1"),
  title: v.optional(v.string()),
  nodes: v.array(dslNodeValidator),
  edges: v.optional(v.array(dslEdgeValidator)),
  groups: v.optional(v.array(dslGroupValidator)),
});

function now() {
  return Date.now();
}

function toResult(whiteboard: {
  _id: Id<"whiteboards">;
  title: string;
  documentId?: Id<"documents">;
  engine: "excalidraw";
  sceneJson: string;
  thumbnailDataUrl?: string;
  sourceDsl?: string;
  sourceDslVersion?: "mwb-dsl-v1";
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: whiteboard._id,
    title: whiteboard.title,
    documentId: whiteboard.documentId,
    engine: whiteboard.engine,
    sceneJson: whiteboard.sceneJson,
    thumbnailDataUrl: whiteboard.thumbnailDataUrl,
    sourceDsl: whiteboard.sourceDsl,
    sourceDslVersion: whiteboard.sourceDslVersion,
    isArchived: whiteboard.isArchived,
    createdAt: whiteboard.createdAt,
    updatedAt: whiteboard.updatedAt,
  };
}

async function requireUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  return identity.subject;
}

async function assertDocumentOwner(
  ctx: { db: { get: (id: Id<"documents">) => Promise<{ userId: string; isArchived: boolean } | null> } },
  documentId: Id<"documents"> | undefined,
  userId: string,
) {
  if (!documentId) return;
  const document = await ctx.db.get(documentId);
  if (!document || document.isArchived) throw new Error("Document not found");
  if (document.userId !== userId) throw new Error("Unauthorized");
}

function sceneFromInput(args: { sceneJson?: string; dsl?: WhiteboardDslDocument }) {
  if (args.sceneJson) return args.sceneJson;
  if (args.dsl) {
    const dsl = parseWhiteboardDsl(args.dsl);
    return stringifyWhiteboardScene(whiteboardDslToExcalidrawScene(dsl));
  }
  return stringifyWhiteboardScene(createEmptyExcalidrawScene());
}

export const create = mutation({
  args: {
    title: v.string(),
    documentId: v.optional(v.id("documents")),
    sceneJson: v.optional(v.string()),
    thumbnailDataUrl: v.optional(v.string()),
    dsl: v.optional(whiteboardDslValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await assertDocumentOwner(ctx, args.documentId, userId);
    const timestamp = now();
    const sceneJson = sceneFromInput(args);
    const whiteboardId = await ctx.db.insert("whiteboards", {
      title: args.title.trim() || "Untitled whiteboard",
      userId,
      documentId: args.documentId,
      engine: "excalidraw",
      sceneJson,
      thumbnailDataUrl: args.thumbnailDataUrl,
      sourceDsl: args.dsl ? JSON.stringify(args.dsl, null, 2) : undefined,
      sourceDslVersion: args.dsl?.version,
      isArchived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const whiteboard = await ctx.db.get(whiteboardId);
    if (!whiteboard) throw new Error("Failed to create whiteboard");
    return toResult(whiteboard);
  },
});

export const getById = query({
  args: { whiteboardId: v.id("whiteboards") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const whiteboard = await ctx.db.get(args.whiteboardId);
    if (!whiteboard || whiteboard.isArchived) throw new Error("Whiteboard not found");
    if (whiteboard.userId !== userId) throw new Error("Unauthorized");
    return toResult(whiteboard);
  },
});

export const listByDocument = query({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await assertDocumentOwner(ctx, args.documentId, userId);
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const rows = await ctx.db
      .query("whiteboards")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .take(limit);
    return rows
      .filter((whiteboard) => !whiteboard.isArchived && whiteboard.userId === userId)
      .map(toResult);
  },
});

export const updateScene = mutation({
  args: {
    whiteboardId: v.id("whiteboards"),
    title: v.optional(v.string()),
    sceneJson: v.string(),
    thumbnailDataUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const whiteboard = await ctx.db.get(args.whiteboardId);
    if (!whiteboard || whiteboard.isArchived) throw new Error("Whiteboard not found");
    if (whiteboard.userId !== userId) throw new Error("Unauthorized");
    const patch: {
      title: string;
      sceneJson: string;
      thumbnailDataUrl?: string;
      updatedAt: number;
    } = {
      title: args.title ?? whiteboard.title,
      sceneJson: args.sceneJson,
      updatedAt: now(),
    };
    if (args.thumbnailDataUrl !== undefined) {
      patch.thumbnailDataUrl = args.thumbnailDataUrl;
    }
    await ctx.db.patch(args.whiteboardId, patch);
    const updated = await ctx.db.get(args.whiteboardId);
    if (!updated) throw new Error("Failed to update whiteboard");
    return toResult(updated);
  },
});

export const updateFromDsl = mutation({
  args: {
    whiteboardId: v.id("whiteboards"),
    title: v.optional(v.string()),
    dsl: whiteboardDslValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const whiteboard = await ctx.db.get(args.whiteboardId);
    if (!whiteboard || whiteboard.isArchived) throw new Error("Whiteboard not found");
    if (whiteboard.userId !== userId) throw new Error("Unauthorized");
    const dsl = parseWhiteboardDsl(args.dsl);
    await ctx.db.patch(args.whiteboardId, {
      title: args.title ?? dsl.title ?? whiteboard.title,
      sceneJson: stringifyWhiteboardScene(whiteboardDslToExcalidrawScene(dsl)),
      sourceDsl: JSON.stringify(args.dsl, null, 2),
      sourceDslVersion: args.dsl.version,
      updatedAt: now(),
    });
    const updated = await ctx.db.get(args.whiteboardId);
    if (!updated) throw new Error("Failed to update whiteboard");
    return toResult(updated);
  },
});

export const archive = mutation({
  args: { whiteboardId: v.id("whiteboards") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const whiteboard = await ctx.db.get(args.whiteboardId);
    if (!whiteboard || whiteboard.userId !== userId) throw new Error("Whiteboard not found");
    await ctx.db.patch(args.whiteboardId, { isArchived: true, updatedAt: now() });
    const updated = await ctx.db.get(args.whiteboardId);
    if (!updated) throw new Error("Failed to archive whiteboard");
    return toResult(updated);
  },
});
