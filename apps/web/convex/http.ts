import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "TOKEN_REVOKED"
  | "TOKEN_EXPIRED"
  | "INSUFFICIENT_SCOPE"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

function createRequestId() {
  return `req_${crypto.randomUUID().replace(/-/g, "")}`;
}

function jsonResponse(body: unknown, requestId: string, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      ...init?.headers,
    },
  });
}

function successResponse(data: unknown, requestId: string, init?: ResponseInit) {
  return jsonResponse({ success: true, data, requestId }, requestId, init);
}

function errorResponse(
  status: number,
  code: ApiErrorCode | string,
  message: string,
  requestId: string,
  init?: ResponseInit,
) {
  return jsonResponse(
    {
      success: false,
      error: { code, message },
      requestId,
    },
    requestId,
    { ...init, status },
  );
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function parseJsonBody(req: Request) {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function endpointKey(method: string, pathname: string) {
  if (pathname === "/cli/v1/auth/status") {
    return `${method} /cli/v1/auth/status`;
  }
  if (pathname === "/cli/v1/tokens/revoke-current") {
    return `${method} /cli/v1/tokens/revoke-current`;
  }
  if (pathname === "/cli/v1/documents") {
    return `${method} /cli/v1/documents`;
  }
  if (pathname === "/cli/v1/documents/search") {
    return `${method} /cli/v1/documents/search`;
  }
  if (pathname.startsWith("/cli/v1/documents/")) {
    return `${method} /cli/v1/documents/:id`;
  }
  return `${method} ${pathname}`;
}

function rateLimitForEndpoint(method: string, pathname: string) {
  if (pathname === "/cli/v1/auth/status") {
    return 60;
  }
  if (pathname === "/cli/v1/tokens/revoke-current") {
    return 10;
  }
  return method === "GET" ? 120 : 30;
}

const cliHttpAction = httpAction(async (ctx, req) => {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const pathname = url.pathname;
  const requiredScope =
    method === "GET" ? "docs:read" : "docs:write";
  const skipScopeCheck =
    pathname === "/cli/v1/auth/status" ||
    pathname === "/cli/v1/tokens/revoke-current";
  let auditAuth: {
    tokenId?: Id<"apiTokens">;
    tokenPrefix?: string;
    userId?: string;
  } = {};

  async function recordAudit(status: number, errorCode?: string) {
    try {
      await ctx.runMutation(internal.cli.recordCliAuditLog, {
        requestId,
        method,
        path: pathname,
        status,
        errorCode,
        requiredScope: skipScopeCheck ? undefined : requiredScope,
        tokenId: auditAuth.tokenId,
        tokenPrefix: auditAuth.tokenPrefix,
        userId: auditAuth.userId,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      console.error(`[CLI HTTP] Audit log failed requestId=${requestId}:`, error);
    }
  }

  async function auditedSuccess(
    data: unknown,
    init?: ResponseInit,
  ) {
    await recordAudit(init?.status ?? 200);
    return successResponse(data, requestId, init);
  }

  async function auditedError(
    status: number,
    code: ApiErrorCode | string,
    message: string,
    init?: ResponseInit,
  ) {
    await recordAudit(status, code);
    return errorResponse(status, code, message, requestId, init);
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return auditedError(401, "UNAUTHORIZED", "Missing Bearer token");
    }

    const tokenHash = await sha256Hex(token);
    const auth = await ctx.runQuery(internal.cli.authenticateApiToken, {
      tokenHash,
      requiredScope: skipScopeCheck ? undefined : requiredScope,
    });

    if (!auth.ok) {
      const failedAuth = auth as {
        tokenId?: Id<"apiTokens">;
        tokenPrefix?: string;
        userId?: string;
      };
      auditAuth = {
        tokenId: failedAuth.tokenId,
        tokenPrefix: failedAuth.tokenPrefix,
        userId: failedAuth.userId,
      };
      return auditedError(auth.status, auth.code, auth.code);
    }

    auditAuth = {
      tokenId: auth.tokenId,
      tokenPrefix: auth.tokenPrefix,
      userId: auth.userId,
    };

    const rateLimit = await ctx.runMutation(
      internal.cli.checkAndIncrementCliRateLimit,
      {
        tokenId: auth.tokenId,
        endpointKey: endpointKey(method, pathname),
        limit: rateLimitForEndpoint(method, pathname),
      },
    );

    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.max(
        Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        1,
      );
      return auditedError(429, "RATE_LIMITED", "Rate limit exceeded", {
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "x-ratelimit-limit": String(rateLimit.limit),
          "x-ratelimit-remaining": String(rateLimit.remaining),
          "x-ratelimit-reset": String(rateLimit.resetAt),
        },
      });
    }

    await ctx.runMutation(internal.cli.recordApiTokenUsed, {
      tokenId: auth.tokenId,
    });

    if (pathname === "/cli/v1/auth/status" && method === "GET") {
      return auditedSuccess({
        authenticated: true,
        tokenPrefix: auth.tokenPrefix,
        scopes: auth.scopes,
        expiresAt: auth.expiresAt,
      });
    }

    if (pathname === "/cli/v1/tokens/revoke-current" && method === "POST") {
      const token = await ctx.runMutation(internal.cli.revokeCurrentApiToken, {
        tokenId: auth.tokenId,
      });
      return auditedSuccess({ token });
    }

    if (pathname === "/cli/v1/documents" && method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? 20);
      const documents = await ctx.runQuery(internal.cli.searchCliDocuments, {
        userId: auth.userId,
        limit: Number.isFinite(limit) ? limit : 20,
      });
      return auditedSuccess({ documents });
    }

    if (pathname === "/cli/v1/documents/search" && method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? 20);
      const documents = await ctx.runQuery(internal.cli.searchCliDocuments, {
        userId: auth.userId,
        query: url.searchParams.get("q") ?? undefined,
        limit: Number.isFinite(limit) ? limit : 20,
      });
      return auditedSuccess({ documents });
    }

    if (pathname === "/cli/v1/documents" && method === "POST") {
      const body = await parseJsonBody(req);
      if (typeof body.title !== "string" || body.title.trim().length === 0) {
        return auditedError(422, "VALIDATION_ERROR", "title is required");
      }

      const document = await ctx.runMutation(internal.cli.createCliDocument, {
        userId: auth.userId,
        title: body.title.trim(),
        contentMarkdown:
          typeof body.contentMarkdown === "string"
            ? body.contentMarkdown
            : undefined,
      });

      return auditedSuccess(document, { status: 201 });
    }

    const documentPrefix = "/cli/v1/documents/";
    if (pathname.startsWith(documentPrefix)) {
      const documentId = decodeURIComponent(
        pathname.slice(documentPrefix.length),
      ) as Id<"documents">;
      if (!documentId || documentId === "search") {
        return auditedError(422, "VALIDATION_ERROR", "document id is required");
      }

      if (method === "GET") {
        const document = await ctx.runQuery(internal.cli.getCliDocument, {
          userId: auth.userId,
          documentId,
        });
        if (!document) {
          return auditedError(404, "NOT_FOUND", "Document not found");
        }
        return auditedSuccess(document);
      }

      if (method === "PATCH") {
        const body = await parseJsonBody(req);
        const mode =
          body.mode === "append" || body.mode === "overwrite"
            ? body.mode
            : "overwrite";

        const document = await ctx.runMutation(internal.cli.updateCliDocument, {
          userId: auth.userId,
          documentId,
          title: typeof body.title === "string" ? body.title : undefined,
          contentMarkdown:
            typeof body.contentMarkdown === "string"
              ? body.contentMarkdown
              : undefined,
          mode,
        });

        if (!document) {
          return auditedError(404, "NOT_FOUND", "Document not found");
        }
        return auditedSuccess(document);
      }

      if (method === "DELETE") {
        const document = await ctx.runMutation(internal.cli.archiveCliDocument, {
          userId: auth.userId,
          documentId,
        });

        if (!document) {
          return auditedError(404, "NOT_FOUND", "Document not found");
        }
        return auditedSuccess(document);
      }
    }

    return auditedError(404, "NOT_FOUND", "CLI endpoint not found");
  } catch (error) {
    console.error(`[CLI HTTP] Error requestId=${requestId}:`, error);
    return auditedError(
      500,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Internal server error",
    );
  }
});

const http = httpRouter();

http.route({
  path: "/cli/v1/auth/status",
  method: "GET",
  handler: cliHttpAction,
});

http.route({
  path: "/cli/v1/tokens/revoke-current",
  method: "POST",
  handler: cliHttpAction,
});

http.route({
  path: "/cli/v1/documents",
  method: "GET",
  handler: cliHttpAction,
});

http.route({
  path: "/cli/v1/documents",
  method: "POST",
  handler: cliHttpAction,
});

http.route({
  path: "/cli/v1/documents/search",
  method: "GET",
  handler: cliHttpAction,
});

http.route({
  pathPrefix: "/cli/v1/documents/",
  method: "GET",
  handler: cliHttpAction,
});

http.route({
  pathPrefix: "/cli/v1/documents/",
  method: "PATCH",
  handler: cliHttpAction,
});

http.route({
  pathPrefix: "/cli/v1/documents/",
  method: "DELETE",
  handler: cliHttpAction,
});

export default http;
