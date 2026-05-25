import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "@convex/server";

const DEFAULT_DOC_SCOPES = ["docs:read", "docs:write"] as const;

function now() {
  return Date.now();
}

function markdownToBlockNoteJson(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const blocks = lines.length > 0 ? lines : [""];

  return JSON.stringify(
    blocks.map((line) => ({
      type: "paragraph",
      content: line,
      children: [],
    })),
    null,
    2,
  );
}

function blockNoteJsonToMarkdown(content?: string) {
  if (!content) return "";

  try {
    const blocks = JSON.parse(content) as Array<{
      content?: string | Array<{ text?: string }>;
    }>;

    return blocks
      .map((block) => {
        if (typeof block.content === "string") return block.content;
        if (Array.isArray(block.content)) {
          return block.content.map((part) => part.text ?? "").join("");
        }
        return "";
      })
      .join("\n");
  } catch {
    return content;
  }
}

function appendMarkdownToBlockNoteJson(existingContent: string | undefined, markdown: string) {
  const existingBlocks = (() => {
    if (!existingContent) return [];
    try {
      const parsed = JSON.parse(existingContent);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const nextBlocks = JSON.parse(markdownToBlockNoteJson(markdown)) as unknown[];
  return JSON.stringify([...existingBlocks, ...nextBlocks], null, 2);
}

function toDocumentResult(document: {
  _id: string;
  title: string;
  content?: string;
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
    isPublished: document.isPublished,
    isInKnowledgeBase: Boolean(document.isInKnowledgeBase),
    lastEditedTime: document.lastEditedTime ?? null,
  };
}

function toApiTokenResult(token: {
  _id: string;
  name: string;
  tokenPrefix: string;
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
      return { ok: false as const, status: 401, code: "TOKEN_REVOKED" };
    }

    if (token.expiresAt && token.expiresAt <= now()) {
      return { ok: false as const, status: 401, code: "TOKEN_EXPIRED" };
    }

    if (args.requiredScope && !token.scopes.includes(args.requiredScope)) {
      return { ok: false as const, status: 403, code: "INSUFFICIENT_SCOPE" };
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
