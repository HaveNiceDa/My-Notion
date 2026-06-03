import { defineTable } from "convex/server";
import { v } from "convex/values";

export const whiteboardsTable = defineTable({
  title: v.string(),
  userId: v.string(),
  documentId: v.optional(v.id("documents")),
  engine: v.literal("excalidraw"),
  sceneJson: v.string(),
  thumbnailDataUrl: v.optional(v.string()),
  sourceDsl: v.optional(v.string()),
  sourceDslVersion: v.optional(v.literal("mwb-dsl-v1")),
  isArchived: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_document", ["documentId"])
  .index("by_user_updated", ["userId", "updatedAt"]);
