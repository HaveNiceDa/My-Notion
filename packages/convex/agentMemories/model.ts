import { v } from "convex/values";

export const memoryTypeValidator = v.union(
  v.literal("preference"),
  v.literal("project"),
  v.literal("episodic"),
);

export const memorySourceValidator = v.union(
  v.literal("user_explicit"),
  v.literal("agent_proposed"),
  v.literal("manual"),
  v.literal("auto_extracted"),
  v.literal("system"),
);

export const memoryStatusValidator = v.union(
  v.literal("pending_review"),
  v.literal("active"),
  v.literal("rejected"),
  v.literal("deleted"),
);

export type LegacyMemoryType = "preference" | "project" | "episodic";

export function clampScore(value: number | undefined, defaultValue: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultValue;
  }
  return Math.min(Math.max(value, 0), 1);
}
