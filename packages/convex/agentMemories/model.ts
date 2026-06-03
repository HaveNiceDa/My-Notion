import { v } from "convex/values";

export const memoryTypeValidator = v.union(
  v.literal("preference"),
  v.literal("project"),
  v.literal("episodic"),
);

export const memoryKindValidator = v.union(
  v.literal("instruction"),
  v.literal("semantic"),
  v.literal("episodic"),
  v.literal("procedural"),
);

export const memoryCategoryValidator = v.string();

export const memoryScopeLevelValidator = v.union(
  v.literal("user"),
  v.literal("workspace"),
  v.literal("project"),
  v.literal("document"),
  v.literal("conversation"),
  v.literal("module"),
  v.literal("path"),
);

export const memorySourceValidator = v.union(
  v.literal("user_explicit"),
  v.literal("agent_proposed"),
  v.literal("manual"),
  v.literal("auto_extracted"),
  v.literal("system"),
);

export const memoryStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pending_review"),
  v.literal("active"),
  v.literal("superseded"),
  v.literal("archived"),
  v.literal("rejected"),
  v.literal("deleted"),
);

export const memoryStabilityValidator = v.union(
  v.literal("stable"),
  v.literal("evolving"),
  v.literal("temporary"),
);

export const memoryPrivacyValidator = v.union(
  v.literal("normal"),
  v.literal("sensitive"),
);

export const memoryEmbeddingStatusValidator = v.union(
  v.literal("pending"),
  v.literal("synced"),
  v.literal("failed"),
  v.literal("skipped"),
);

export type LegacyMemoryType = "preference" | "project" | "episodic";
export type MemoryKind = "instruction" | "semantic" | "episodic" | "procedural";
export type MemoryScopeLevel =
  | "user"
  | "workspace"
  | "project"
  | "document"
  | "conversation"
  | "module"
  | "path";
export type MemoryStability = "stable" | "evolving" | "temporary";
export type MemoryPrivacy = "normal" | "sensitive";
export type MemoryEmbeddingStatus = "pending" | "synced" | "failed" | "skipped";

export interface MemoryModelDefaults {
  kind: MemoryKind;
  category: string;
  scopeLevel: MemoryScopeLevel;
  scopeKey: string;
  importance: number;
  stability: MemoryStability;
  privacy: MemoryPrivacy;
  usageCount: number;
  embeddingStatus: MemoryEmbeddingStatus;
  embeddingRetryCount: number;
}

/** M23 兼容层：旧 type 仍是写入契约，新字段由这里派生，后续阶段再逐步显式传入。 */
export function deriveMemoryDefaults(
  type: LegacyMemoryType,
  userId: string,
): MemoryModelDefaults {
  return {
    kind: defaultKindForType(type),
    category: defaultCategoryForType(type),
    scopeLevel: "user",
    scopeKey: userId,
    importance: 0.5,
    stability: type === "episodic" ? "temporary" : "evolving",
    privacy: "normal",
    usageCount: 0,
    embeddingStatus: "pending",
    embeddingRetryCount: 0,
  };
}

export function defaultKindForType(type: LegacyMemoryType): MemoryKind {
  if (type === "preference") return "instruction";
  if (type === "project") return "semantic";
  return "episodic";
}

export function defaultCategoryForType(type: LegacyMemoryType): string {
  if (type === "preference") return "user_preference";
  if (type === "project") return "project_fact";
  return "session_note";
}

export function clampScore(value: number | undefined, defaultValue: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultValue;
  }
  return Math.min(Math.max(value, 0), 1);
}
