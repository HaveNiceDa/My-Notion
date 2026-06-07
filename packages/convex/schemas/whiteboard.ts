import { defineTable } from "convex/server";
import { v } from "convex/values";

export const whiteboardsTable = defineTable({
  title: v.string(),
  userId: v.string(),
  documentId: v.optional(v.id("documents")),
  engine: v.literal("excalidraw"),
  sceneJson: v.string(),
  thumbnailDataUrl: v.optional(v.string()),
  sceneObjectKey: v.optional(v.string()),
  sceneObjectUrl: v.optional(v.string()),
  sceneHash: v.optional(v.string()),
  sceneBytes: v.optional(v.number()),
  thumbnailObjectKey: v.optional(v.string()),
  thumbnailUrl: v.optional(v.string()),
  thumbnailHash: v.optional(v.string()),
  thumbnailBytes: v.optional(v.number()),
  assetVersion: v.optional(v.number()),
  assetMigratedAt: v.optional(v.number()),
  sourceDsl: v.optional(v.string()),
  sourceDslVersion: v.optional(v.literal("mwb-dsl-v1")),
  isArchived: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_document", ["documentId"])
  .index("by_user_updated", ["userId", "updatedAt"]);
