import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "@convex/server";
import {
  appendMarkdownToBlockNoteJson,
  blockNoteJsonToMarkdown,
  markdownToBlockNoteJson,
} from "../documents/logic/markdown";

const DEFAULT_DOC_SCOPES = ["docs:read", "docs:write"] as const;
const DEFAULT_CLI_TOKEN_NAME = "Default CLI Token";
const DEVICE_FLOW_TOKEN_NAME = "CLI Browser Login";
const RATE_LIMIT_WINDOW_MS = 60_000;
const DEVICE_AUTH_DECISION_WINDOW_MS = 5_000;

function now() {
  return Date.now();
}

function latestFirst<T extends { createdAt: number }>(left: T, right: T) {
  return right.createdAt - left.createdAt;
}

function createRateLimitWindow(timestamp: number, windowMs: number) {
  const windowStart = Math.floor(timestamp / windowMs) * windowMs;
  return {
    windowStart,
    expiresAt: windowStart + windowMs,
    windowKey: String(windowStart),
  };
}

function isDecisionRateLimited(session: {
  lastDecisionAttemptAt?: number;
  decisionAttemptCount?: number;
}, timestamp: number) {
  const lastAttemptAt = session.lastDecisionAttemptAt ?? 0;
  const attempts = session.decisionAttemptCount ?? 0;
  return (
    attempts > 0 &&
    timestamp - lastAttemptAt < DEVICE_AUTH_DECISION_WINDOW_MS
  );
}

async function recordDecisionAttempt(
  ctx: { db: any },
  session: { _id: unknown; decisionAttemptCount?: number },
  timestamp: number,
) {
  await ctx.db.patch(session._id, {
    lastDecisionAttemptAt: timestamp,
    decisionAttemptCount: (session.decisionAttemptCount ?? 0) + 1,
  });
}

function toDocumentResult(document: {
  _id: string;
  title: string;
  content?: string;
  isArchived?: boolean;
  isInKnowledgeBase?: boolean;
  isPublished: boolean;
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

function toApiTokenResult(token: {
  _id: string;
  name: string;
  tokenPrefix: string;
  tokenPlaintext?: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
  revokedAt?: number;
}) {
  return {
    id: token._id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    token: token.tokenPlaintext ?? null,
    scopes: token.scopes,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt ?? null,
    expiresAt: token.expiresAt ?? null,
    revokedAt: token.revokedAt ?? null,
  };
}

/** 登录态用户创建 PAT 时使用；明文 token 由调用方生成，只保存哈希。 */
export const createApiTokenRecord = mutation({
  args: {
    name: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    scopes: v.optional(v.array(v.string())),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const existing = await ctx.db
      .query("apiTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (existing) {
      throw new Error("Token already exists");
    }

    const tokenId = await ctx.db.insert("apiTokens", {
      userId: identity.subject,
      name: args.name,
      tokenHash: args.tokenHash,
      tokenPrefix: args.tokenPrefix,
      scopes: args.scopes ?? [...DEFAULT_DOC_SCOPES],
      createdAt: now(),
      expiresAt: args.expiresAt,
    });

    return { id: tokenId, tokenPrefix: args.tokenPrefix };
  },
});

/** 登录态用户列出自己的 PAT 元信息，不返回 token 明文或哈希。 */
export const listApiTokenRecords = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const tokens = await ctx.db
      .query("apiTokens")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    return tokens.map(toApiTokenResult);
  },
});

/** 登录态用户读取或创建默认 CLI token；个人版为了易用性会返回明文。 */
export const ensureDefaultApiTokenRecord = mutation({
  args: {
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    tokenPlaintext: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const defaultTokens = await ctx.db
      .query("apiTokens")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    const existing = defaultTokens
      .filter((token) => token.name === DEFAULT_CLI_TOKEN_NAME && !token.revokedAt)
      .sort(latestFirst)[0];
    if (existing?.tokenPlaintext) {
      for (const token of defaultTokens) {
        if (token._id !== existing._id) {
          await ctx.db.delete(token._id);
        }
      }
      return toApiTokenResult(existing);
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        tokenHash: args.tokenHash,
        tokenPrefix: args.tokenPrefix,
        tokenPlaintext: args.tokenPlaintext,
        scopes: [...DEFAULT_DOC_SCOPES],
      });

      for (const token of defaultTokens) {
        if (token._id !== existing._id) {
          await ctx.db.delete(token._id);
        }
      }

      return toApiTokenResult({
        ...existing,
        tokenPrefix: args.tokenPrefix,
        tokenPlaintext: args.tokenPlaintext,
        scopes: [...DEFAULT_DOC_SCOPES],
      });
    }

    const createdAt = now();
    const tokenId = await ctx.db.insert("apiTokens", {
      userId: identity.subject,
      name: DEFAULT_CLI_TOKEN_NAME,
      tokenHash: args.tokenHash,
      tokenPrefix: args.tokenPrefix,
      tokenPlaintext: args.tokenPlaintext,
      scopes: [...DEFAULT_DOC_SCOPES],
      createdAt,
    });

    for (const token of defaultTokens) {
      await ctx.db.delete(token._id);
    }

    return toApiTokenResult({
      _id: tokenId,
      name: DEFAULT_CLI_TOKEN_NAME,
      tokenPrefix: args.tokenPrefix,
      tokenPlaintext: args.tokenPlaintext,
      scopes: [...DEFAULT_DOC_SCOPES],
      createdAt,
    });
  },
});

/** 重置默认 CLI token 明文和 hash；旧明文会立即失效。 */
export const resetDefaultApiTokenRecord = mutation({
  args: {
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    tokenPlaintext: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const defaultTokens = await ctx.db
      .query("apiTokens")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    const existing = defaultTokens
      .filter((token) => token.name === DEFAULT_CLI_TOKEN_NAME && !token.revokedAt)
      .sort(latestFirst)[0];
    if (!existing) {
      const createdAt = now();
      const tokenId = await ctx.db.insert("apiTokens", {
        userId: identity.subject,
        name: DEFAULT_CLI_TOKEN_NAME,
        tokenHash: args.tokenHash,
        tokenPrefix: args.tokenPrefix,
        tokenPlaintext: args.tokenPlaintext,
        scopes: [...DEFAULT_DOC_SCOPES],
        createdAt,
      });

      for (const token of defaultTokens) {
        await ctx.db.delete(token._id);
      }

      return toApiTokenResult({
        _id: tokenId,
        name: DEFAULT_CLI_TOKEN_NAME,
        tokenPrefix: args.tokenPrefix,
        tokenPlaintext: args.tokenPlaintext,
        scopes: [...DEFAULT_DOC_SCOPES],
        createdAt,
      });
    }

    await ctx.db.patch(existing._id, {
      tokenHash: args.tokenHash,
      tokenPrefix: args.tokenPrefix,
      tokenPlaintext: args.tokenPlaintext,
      scopes: [...DEFAULT_DOC_SCOPES],
    });

    for (const token of defaultTokens) {
      if (token._id !== existing._id) {
        await ctx.db.delete(token._id);
      }
    }

    return toApiTokenResult({
      ...existing,
      tokenPrefix: args.tokenPrefix,
      tokenPlaintext: args.tokenPlaintext,
      scopes: [...DEFAULT_DOC_SCOPES],
    });
  },
});

/** 登录态用户撤销自己的 PAT；撤销后该 token 立即无法访问 CLI API。 */
export const revokeApiTokenRecord = mutation({
  args: {
    tokenId: v.id("apiTokens"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.userId !== identity.subject) {
      throw new Error("Token not found");
    }

    const revokedAt = token.revokedAt ?? now();
    await ctx.db.patch(args.tokenId, { revokedAt });

    return toApiTokenResult({ ...token, revokedAt });
  },
});

export const authenticateApiToken = internalQuery({
  args: {
    tokenHash: v.string(),
    requiredScope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("apiTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (!token) {
      return { ok: false as const, status: 401, code: "UNAUTHORIZED" };
    }

    if (token.revokedAt) {
      return {
        ok: false as const,
        status: 401,
        code: "TOKEN_REVOKED",
        tokenId: token._id,
        userId: token.userId,
        tokenPrefix: token.tokenPrefix,
        scopes: token.scopes,
      };
    }

    if (token.expiresAt && token.expiresAt <= now()) {
      return {
        ok: false as const,
        status: 401,
        code: "TOKEN_EXPIRED",
        tokenId: token._id,
        userId: token.userId,
        tokenPrefix: token.tokenPrefix,
        scopes: token.scopes,
      };
    }

    if (args.requiredScope && !token.scopes.includes(args.requiredScope)) {
      return {
        ok: false as const,
        status: 403,
        code: "INSUFFICIENT_SCOPE",
        tokenId: token._id,
        userId: token.userId,
        tokenPrefix: token.tokenPrefix,
        scopes: token.scopes,
      };
    }

    return {
      ok: true as const,
      tokenId: token._id,
      userId: token.userId,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      scopes: token.scopes,
      expiresAt: token.expiresAt ?? null,
    };
  },
});

export const recordApiTokenUsed = internalMutation({
  args: {
    tokenId: v.id("apiTokens"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tokenId, { lastUsedAt: now() });
    return { success: true };
  },
});

export const recordCliAuditLog = internalMutation({
  args: {
    requestId: v.string(),
    method: v.string(),
    path: v.string(),
    status: v.number(),
    errorCode: v.optional(v.string()),
    requiredScope: v.optional(v.string()),
    tokenId: v.optional(v.id("apiTokens")),
    tokenPrefix: v.optional(v.string()),
    userId: v.optional(v.string()),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("cliAuditLogs", {
      requestId: args.requestId,
      method: args.method,
      path: args.path,
      status: args.status,
      errorCode: args.errorCode,
      requiredScope: args.requiredScope,
      tokenId: args.tokenId,
      tokenPrefix: args.tokenPrefix,
      userId: args.userId,
      durationMs: args.durationMs,
      createdAt: now(),
    });

    return { success: true };
  },
});

export const checkAndIncrementCliRateLimit = internalMutation({
  args: {
    tokenId: v.id("apiTokens"),
    endpointKey: v.string(),
    limit: v.number(),
    windowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timestamp = now();
    const windowMs = args.windowMs ?? RATE_LIMIT_WINDOW_MS;
    const { windowStart, expiresAt, windowKey } = createRateLimitWindow(
      timestamp,
      windowMs,
    );
    const existing = await ctx.db
      .query("cliRateLimits")
      .withIndex("by_token_endpoint_window", (q) =>
        q
          .eq("tokenId", args.tokenId)
          .eq("endpointKey", args.endpointKey)
          .eq("windowKey", windowKey),
      )
      .unique();

    const currentCount = existing?.count ?? 0;
    if (currentCount >= args.limit) {
      return {
        allowed: false as const,
        limit: args.limit,
        remaining: 0,
        resetAt: expiresAt,
      };
    }

    const nextCount = currentCount + 1;
    if (existing) {
      await ctx.db.patch(existing._id, {
        count: nextCount,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("cliRateLimits", {
        tokenId: args.tokenId,
        endpointKey: args.endpointKey,
        windowKey,
        count: nextCount,
        windowStart,
        expiresAt,
        updatedAt: timestamp,
      });
    }

    return {
      allowed: true as const,
      limit: args.limit,
      remaining: Math.max(args.limit - nextCount, 0),
      resetAt: expiresAt,
    };
  },
});

export const revokeCurrentApiToken = internalMutation({
  args: {
    tokenId: v.id("apiTokens"),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.tokenId);
    if (!token) {
      throw new Error("Token not found");
    }

    const revokedAt = token.revokedAt ?? now();
    await ctx.db.patch(args.tokenId, { revokedAt });

    return toApiTokenResult({ ...token, revokedAt });
  },
});

export const createCliDocument = internalMutation({
  args: {
    userId: v.string(),
    title: v.string(),
    contentMarkdown: v.optional(v.string()),
    parentDocument: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      parentDocument: args.parentDocument,
      userId: args.userId,
      content: args.contentMarkdown
        ? markdownToBlockNoteJson(args.contentMarkdown)
        : undefined,
      isArchived: false,
      isPublished: false,
      isStarred: false,
      isInKnowledgeBase: true,
      lastEditedTime: now(),
    });

    const document = await ctx.db.get(documentId);
    if (!document) {
      throw new Error("Failed to create document");
    }

    return toDocumentResult(document);
  },
});

export const getCliDocument = internalQuery({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.isArchived || document.userId !== args.userId) {
      return null;
    }

    return toDocumentResult(document);
  },
});

export const searchCliDocuments = internalQuery({
  args: {
    userId: v.string(),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const query = args.query?.trim().toLowerCase();
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();

    return documents
      .filter((document) => {
        if (!query) return true;
        const contentMarkdown = blockNoteJsonToMarkdown(document.content).toLowerCase();
        return (
          document.title.toLowerCase().includes(query) ||
          contentMarkdown.includes(query)
        );
      })
      .slice(0, limit)
      .map(toDocumentResult);
  },
});

export const updateCliDocument = internalMutation({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    contentMarkdown: v.optional(v.string()),
    mode: v.optional(v.union(v.literal("overwrite"), v.literal("append"))),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.isArchived || document.userId !== args.userId) {
      return null;
    }

    const patch: {
      title?: string;
      content?: string;
      lastEditedTime: number;
    } = {
      lastEditedTime: now(),
    };

    if (args.title !== undefined) {
      patch.title = args.title;
    }

    if (args.contentMarkdown !== undefined) {
      patch.content =
        args.mode === "append"
          ? appendMarkdownToBlockNoteJson(document.content, args.contentMarkdown)
          : markdownToBlockNoteJson(args.contentMarkdown);
    }

    await ctx.db.patch(args.documentId, patch);
    const updatedDocument = await ctx.db.get(args.documentId);
    if (!updatedDocument) {
      throw new Error("Failed to update document");
    }

    return toDocumentResult(updatedDocument);
  },
});

export const archiveCliDocument = internalMutation({
  args: {
    userId: v.string(),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.userId !== args.userId) {
      return null;
    }

    if (!document.isArchived) {
      await ctx.db.patch(args.documentId, {
        isArchived: true,
        lastEditedTime: now(),
      });
    }

    const archivedDocument = await ctx.db.get(args.documentId);
    if (!archivedDocument) {
      throw new Error("Failed to archive document");
    }

    return toDocumentResult(archivedDocument);
  },
});

export const createCliDeviceAuthSession = mutation({
  args: {
    deviceCodeHash: v.string(),
    userCodeHash: v.string(),
    userCodeDisplay: v.string(),
    scopes: v.array(v.string()),
    profile: v.optional(v.string()),
    apiUrl: v.optional(v.string()),
    webUrl: v.optional(v.string()),
    clientName: v.optional(v.string()),
    clientVersion: v.optional(v.string()),
    machineName: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("cliDeviceAuthSessions")
      .withIndex("by_device_code_hash", (q) =>
        q.eq("deviceCodeHash", args.deviceCodeHash),
      )
      .unique();

    if (existing) {
      throw new Error("Device code already exists");
    }

    await ctx.db.insert("cliDeviceAuthSessions", {
      deviceCodeHash: args.deviceCodeHash,
      userCodeHash: args.userCodeHash,
      userCodeDisplay: args.userCodeDisplay,
      status: "pending",
      scopes: args.scopes.length > 0 ? args.scopes : [...DEFAULT_DOC_SCOPES],
      profile: args.profile,
      apiUrl: args.apiUrl,
      webUrl: args.webUrl,
      clientName: args.clientName,
      clientVersion: args.clientVersion,
      machineName: args.machineName,
      createdAt: now(),
      expiresAt: args.expiresAt,
      pollCount: 0,
    });

    return { success: true };
  },
});

export const getCliDeviceAuthSessionByUserCode = query({
  args: {
    userCodeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("cliDeviceAuthSessions")
      .withIndex("by_user_code_hash", (q) =>
        q.eq("userCodeHash", args.userCodeHash),
      )
      .unique();

    if (!session) return null;

    return {
      userCodeDisplay: session.userCodeDisplay,
      status: session.expiresAt <= now() ? "expired" : session.status,
      scopes: session.scopes,
      profile: session.profile ?? null,
      apiUrl: session.apiUrl ?? null,
      webUrl: session.webUrl ?? null,
      clientName: session.clientName ?? null,
      machineName: session.machineName ?? null,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
  },
});

export const approveCliDeviceAuthSession = mutation({
  args: {
    userCodeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const session = await ctx.db
      .query("cliDeviceAuthSessions")
      .withIndex("by_user_code_hash", (q) =>
        q.eq("userCodeHash", args.userCodeHash),
      )
      .unique();

    if (!session) return { ok: false as const, code: "INVALID_DEVICE_CODE" };

    const timestamp = now();
    if (isDecisionRateLimited(session, timestamp)) {
      return { ok: false as const, code: "DECISION_RATE_LIMITED" };
    }
    await recordDecisionAttempt(ctx, session, timestamp);

    if (session.expiresAt <= timestamp) {
      await ctx.db.patch(session._id, { status: "expired" });
      return { ok: false as const, code: "DEVICE_CODE_EXPIRED" };
    }
    if (session.status !== "pending") {
      return { ok: false as const, code: `DEVICE_CODE_${session.status.toUpperCase()}` };
    }

    await ctx.db.patch(session._id, {
      status: "approved",
      userId: identity.subject,
      approvedAt: timestamp,
    });

    return { ok: true as const };
  },
});

export const denyCliDeviceAuthSession = mutation({
  args: {
    userCodeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const session = await ctx.db
      .query("cliDeviceAuthSessions")
      .withIndex("by_user_code_hash", (q) =>
        q.eq("userCodeHash", args.userCodeHash),
      )
      .unique();

    if (!session) return { ok: false as const, code: "INVALID_DEVICE_CODE" };

    const timestamp = now();
    if (isDecisionRateLimited(session, timestamp)) {
      return { ok: false as const, code: "DECISION_RATE_LIMITED" };
    }
    await recordDecisionAttempt(ctx, session, timestamp);

    if (session.expiresAt <= timestamp) {
      await ctx.db.patch(session._id, { status: "expired" });
      return { ok: false as const, code: "DEVICE_CODE_EXPIRED" };
    }
    if (session.status !== "pending") {
      return { ok: false as const, code: `DEVICE_CODE_${session.status.toUpperCase()}` };
    }

    await ctx.db.patch(session._id, {
      status: "denied",
    });

    return { ok: true as const };
  },
});

export const pollCliDeviceAuthSession = mutation({
  args: {
    deviceCodeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("cliDeviceAuthSessions")
      .withIndex("by_device_code_hash", (q) =>
        q.eq("deviceCodeHash", args.deviceCodeHash),
      )
      .unique();

    if (!session) return { status: "invalid" as const };

    const timestamp = now();
    if (session.expiresAt <= timestamp && session.status === "pending") {
      await ctx.db.patch(session._id, {
        status: "expired",
        lastPolledAt: timestamp,
        pollCount: (session.pollCount ?? 0) + 1,
      });
      return { status: "expired" as const };
    }

    await ctx.db.patch(session._id, {
      lastPolledAt: timestamp,
      pollCount: (session.pollCount ?? 0) + 1,
    });

    return {
      status: session.status,
      expiresAt: session.expiresAt,
      scopes: session.scopes,
    };
  },
});

export const consumeCliDeviceAuthSessionAndCreateToken = mutation({
  args: {
    deviceCodeHash: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("cliDeviceAuthSessions")
      .withIndex("by_device_code_hash", (q) =>
        q.eq("deviceCodeHash", args.deviceCodeHash),
      )
      .unique();

    if (!session) return { ok: false as const, code: "INVALID_DEVICE_CODE" };
    if (session.expiresAt <= now()) {
      await ctx.db.patch(session._id, { status: "expired" });
      return { ok: false as const, code: "DEVICE_CODE_EXPIRED" };
    }
    if (session.status === "denied") {
      return { ok: false as const, code: "AUTHORIZATION_DENIED" };
    }
    if (session.status === "consumed") {
      return { ok: false as const, code: "DEVICE_CODE_CONSUMED" };
    }
    if (session.status !== "approved" || !session.userId) {
      return { ok: false as const, code: "AUTHORIZATION_PENDING" };
    }

    const existing = await ctx.db
      .query("apiTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (existing) {
      throw new Error("Token already exists");
    }

    const createdAt = now();
    const tokenId = await ctx.db.insert("apiTokens", {
      userId: session.userId,
      name: DEVICE_FLOW_TOKEN_NAME,
      tokenHash: args.tokenHash,
      tokenPrefix: args.tokenPrefix,
      scopes: session.scopes.length > 0 ? session.scopes : [...DEFAULT_DOC_SCOPES],
      createdAt,
    });

    await ctx.db.patch(session._id, {
      status: "consumed",
      consumedAt: createdAt,
    });

    return {
      ok: true as const,
      token: {
        id: tokenId,
        name: DEVICE_FLOW_TOKEN_NAME,
        tokenPrefix: args.tokenPrefix,
        scopes: session.scopes.length > 0 ? session.scopes : [...DEFAULT_DOC_SCOPES],
        createdAt,
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: null,
      },
    };
  },
});
