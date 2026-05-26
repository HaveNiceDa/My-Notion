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
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

function successResponse(data: unknown, init?: ResponseInit) {
  return jsonResponse({ success: true, data }, init);
}

function errorResponse(status: number, code: ApiErrorCode | string, message: string) {
  return jsonResponse(
    {
      success: false,
      error: { code, message },
    },
    { status },
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

const cliHttpAction = httpAction(async (ctx, req) => {
  try {
    const url = new URL(req.url);
    const token = getBearerToken(req);
    if (!token) {
      return errorResponse(401, "UNAUTHORIZED", "Missing Bearer token");
    }

    const tokenHash = await sha256Hex(token);
    const method = req.method.toUpperCase();
    const pathname = url.pathname;
    const requiredScope = method === "GET" ? "docs:read" : "docs:write";
    const skipScopeCheck =
      pathname === "/cli/v1/auth/status" ||
      pathname === "/cli/v1/tokens/revoke-current";
    const auth = await ctx.runQuery(internal.cli.authenticateApiToken, {
      tokenHash,
      requiredScope: skipScopeCheck ? undefined : requiredScope,
    });

    if (!auth.ok) {
      return errorResponse(auth.status, auth.code, auth.code);
    }

    await ctx.runMutation(internal.cli.recordApiTokenUsed, {
      tokenId: auth.tokenId,
    });

    if (pathname === "/cli/v1/auth/status" && method === "GET") {
      return successResponse({
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
      return successResponse({ token });
    }

    if (pathname === "/cli/v1/documents" && method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? 20);
      const documents = await ctx.runQuery(internal.cli.searchCliDocuments, {
        userId: auth.userId,
        limit: Number.isFinite(limit) ? limit : 20,
      });
      return successResponse({ documents });
    }

    if (pathname === "/cli/v1/documents/search" && method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? 20);
      const documents = await ctx.runQuery(internal.cli.searchCliDocuments, {
        userId: auth.userId,
        query: url.searchParams.get("q") ?? undefined,
        limit: Number.isFinite(limit) ? limit : 20,
      });
      return successResponse({ documents });
    }

    if (pathname === "/cli/v1/documents" && method === "POST") {
      const body = await parseJsonBody(req);
      if (typeof body.title !== "string" || body.title.trim().length === 0) {
        return errorResponse(400, "BAD_REQUEST", "title is required");
      }

      const document = await ctx.runMutation(internal.cli.createCliDocument, {
        userId: auth.userId,
        title: body.title.trim(),
        contentMarkdown:
          typeof body.contentMarkdown === "string"
            ? body.contentMarkdown
            : undefined,
      });

      return successResponse(document, { status: 201 });
    }

    const documentPrefix = "/cli/v1/documents/";
    if (pathname.startsWith(documentPrefix)) {
      const documentId = decodeURIComponent(
        pathname.slice(documentPrefix.length),
      ) as Id<"documents">;
      if (!documentId || documentId === "search") {
        return errorResponse(400, "BAD_REQUEST", "document id is required");
      }

      if (method === "GET") {
        const document = await ctx.runQuery(internal.cli.getCliDocument, {
          userId: auth.userId,
          documentId,
        });
        if (!document) {
          return errorResponse(404, "NOT_FOUND", "Document not found");
        }
        return successResponse(document);
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
          return errorResponse(404, "NOT_FOUND", "Document not found");
        }
        return successResponse(document);
      }

      if (method === "DELETE") {
        const document = await ctx.runMutation(internal.cli.archiveCliDocument, {
          userId: auth.userId,
          documentId,
        });

        if (!document) {
          return errorResponse(404, "NOT_FOUND", "Document not found");
        }
        return successResponse(document);
      }
    }

    return errorResponse(404, "NOT_FOUND", "CLI endpoint not found");
  } catch (error) {
    console.error("[CLI HTTP] Error:", error);
    return errorResponse(
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
