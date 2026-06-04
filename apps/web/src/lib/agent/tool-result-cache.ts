import type { ToolContext } from "./tools/types";

const TOOL_RESULT_CACHE_TTL_MS = 5 * 60 * 1000;
const TOOL_RESULT_CACHE_MAX_SIZE = 200;

const CACHEABLE_TOOL_NAMES = new Set([
  "knowledge_search",
  "web_search",
  "web_extract",
  "document_search",
  "document_read",
  "memory_search",
]);

interface ToolCacheEntry {
  value: string;
  expiresAt: number;
}

const toolResultCache = new Map<string, ToolCacheEntry>();

export interface ToolCacheLookup {
  hit: boolean;
  value?: string;
}

export interface ToolCacheInvalidationFilter {
  userId?: string;
  toolNames?: string[];
}

// 只读 tool 的跨请求缓存：按用户、当前文档上下文和规范化参数隔离，避免串用户或串页面。
export function getCachedToolResult(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext,
): ToolCacheLookup {
  if (!isCacheableTool(toolName)) {
    return { hit: false };
  }

  const key = getToolCacheKey(toolName, args, context);
  const entry = toolResultCache.get(key);
  if (!entry) {
    return { hit: false };
  }

  if (entry.expiresAt <= nowMs()) {
    toolResultCache.delete(key);
    return { hit: false };
  }

  // Map 通过 delete + set 维护 LRU 顺序。
  toolResultCache.delete(key);
  toolResultCache.set(key, entry);
  return { hit: true, value: entry.value };
}

export function setCachedToolResult(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext,
  value: string,
): void {
  if (!isCacheableTool(toolName)) {
    return;
  }

  const key = getToolCacheKey(toolName, args, context);
  toolResultCache.set(key, {
    value,
    expiresAt: nowMs() + TOOL_RESULT_CACHE_TTL_MS,
  });
  pruneExpiredEntries();
  pruneLruEntries();
}

export function getToolSignature(toolName: string, args: Record<string, unknown>): string {
  return `${toolName}:${stableStringify(args)}`;
}

export function isCacheableTool(toolName: string): boolean {
  return CACHEABLE_TOOL_NAMES.has(toolName);
}

export function clearToolResultCache(): void {
  toolResultCache.clear();
}

export function getToolResultCacheSize(): number {
  return toolResultCache.size;
}

export function invalidateToolResultCache(filter: ToolCacheInvalidationFilter = {}): number {
  const toolNameSet = filter.toolNames ? new Set(filter.toolNames) : undefined;
  let deleted = 0;

  for (const key of toolResultCache.keys()) {
    const metadata = parseToolCacheKey(key);
    if (!metadata) continue;
    if (filter.userId && metadata.userId !== filter.userId) continue;
    if (toolNameSet && (!metadata.toolName || !toolNameSet.has(metadata.toolName))) continue;

    toolResultCache.delete(key);
    deleted += 1;
  }

  return deleted;
}

function getToolCacheKey(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext,
): string {
  return stableStringify({
    userId: context.userId,
    toolName,
    args,
    currentDocument: context.currentDocument
      ? {
          id: context.currentDocument.id,
          title: context.currentDocument.title,
          content: context.currentDocument.content ?? null,
        }
      : null,
  });
}

function parseToolCacheKey(key: string): { userId?: string; toolName?: string } | undefined {
  try {
    const parsed = JSON.parse(key) as { userId?: unknown; toolName?: unknown };
    return {
      userId: typeof parsed.userId === "string" ? parsed.userId : undefined,
      toolName: typeof parsed.toolName === "string" ? parsed.toolName : undefined,
    };
  } catch {
    return undefined;
  }
}

function pruneExpiredEntries(): void {
  const current = nowMs();
  for (const [key, entry] of toolResultCache.entries()) {
    if (entry.expiresAt <= current) {
      toolResultCache.delete(key);
    }
  }
}

function pruneLruEntries(): void {
  while (toolResultCache.size > TOOL_RESULT_CACHE_MAX_SIZE) {
    const oldestKey = toolResultCache.keys().next().value as string | undefined;
    if (!oldestKey) return;
    toolResultCache.delete(oldestKey);
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nestedValue]) => [key, sortObject(nestedValue)]),
  );
}

function nowMs(): number {
  return Date.now();
}
