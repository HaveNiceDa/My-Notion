import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { WhiteboardDslDocument } from "@notion/business/whiteboard";

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

function parseWhiteboardDslBody(value: unknown): WhiteboardDslDocument | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Partial<WhiteboardDslDocument>;
  if (candidate.version !== "mwb-dsl-v1" || !Array.isArray(candidate.nodes)) {
    return undefined;
  }
  return candidate as WhiteboardDslDocument;
}

function requiredScopeForEndpoint(method: string, pathname: string) {
  if (pathname.startsWith("/cli/v1/whiteboards")) {
    return method === "GET" || (method === "POST" && pathname.endsWith("/export"))
      ? "whiteboards:read"
      : "whiteboards:write";
  }
  return method === "GET" ? "docs:read" : "docs:write";
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type SvgSceneElement = {
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  strokeColor?: string;
  backgroundColor?: string;
  text?: string;
  fontSize?: number;
  points?: Array<[number, number]>;
};

function isSceneElement(value: unknown): value is SvgSceneElement {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function createFallbackWhiteboardSvg(title: string) {
  const safeTitle = escapeXml(title);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="100%" height="100%" fill="#fff"/><rect x="24" y="24" width="912" height="492" rx="18" fill="#fff" stroke="#d0d7de"/><text x="48" y="72" font-family="sans-serif" font-size="24" font-weight="600" fill="#24292f">${safeTitle}</text><text x="48" y="112" font-family="sans-serif" font-size="14" fill="#57606a">Open scene.json in My-Notion or Excalidraw for full fidelity.</text></svg>`;
}

function renderSceneElementToSvg(element: SvgSceneElement) {
  const x = element.x ?? 0;
  const y = element.y ?? 0;
  const width = element.width ?? 0;
  const height = element.height ?? 0;
  const stroke = escapeXml(element.strokeColor ?? "#1e1e1e");
  const fill = escapeXml(element.backgroundColor && element.backgroundColor !== "transparent"
    ? element.backgroundColor
    : "none");

  if (element.type === "text") {
    const text = escapeXml(element.text ?? "");
    const fontSize = element.fontSize ?? 20;
    return `<text x="${x}" y="${y + fontSize}" font-family="sans-serif" font-size="${fontSize}" fill="${stroke}">${text}</text>`;
  }

  if (element.type === "ellipse") {
    return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${Math.abs(width / 2)}" ry="${Math.abs(height / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }

  if (element.type === "diamond") {
    const points = [
      `${x + width / 2},${y}`,
      `${x + width},${y + height / 2}`,
      `${x + width / 2},${y + height}`,
      `${x},${y + height / 2}`,
    ].join(" ");
    return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }

  if ((element.type === "arrow" || element.type === "line") && Array.isArray(element.points)) {
    const points = element.points
      .map((point) => `${x + point[0]},${y + point[1]}`)
      .join(" ");
    const marker = element.type === "arrow" ? ' marker-end="url(#arrowhead)"' : "";
    return `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="2"${marker}/>`;
  }

  if (element.type === "rectangle" || element.type === "frame") {
    return `<rect x="${x}" y="${y}" width="${Math.abs(width)}" height="${Math.abs(height)}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  }

  return "";
}

function createWhiteboardSvg(title: string, sceneJson: string) {
  try {
    const parsed = JSON.parse(sceneJson) as { elements?: unknown };
    const elements = Array.isArray(parsed.elements)
      ? parsed.elements.filter(isSceneElement)
      : [];
    if (elements.length === 0) return createFallbackWhiteboardSvg(title);
    const minX = Math.min(...elements.map((element) => element.x ?? 0));
    const minY = Math.min(...elements.map((element) => element.y ?? 0));
    const maxX = Math.max(...elements.map((element) => (element.x ?? 0) + Math.abs(element.width ?? 0)));
    const maxY = Math.max(...elements.map((element) => (element.y ?? 0) + Math.abs(element.height ?? 0)));
    const padding = 48;
    const viewBox = [
      minX - padding,
      minY - padding,
      Math.max(maxX - minX + padding * 2, 320),
      Math.max(maxY - minY + padding * 2, 180),
    ].join(" ");
    const body = elements.map(renderSceneElementToSvg).filter(Boolean).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="${viewBox}"><defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#1e1e1e"/></marker></defs><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
  } catch {
    return createFallbackWhiteboardSvg(title);
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
  if (pathname === "/cli/v1/whiteboards") {
    return `${method} /cli/v1/whiteboards`;
  }
  if (pathname.startsWith("/cli/v1/whiteboards/")) {
    return `${method} /cli/v1/whiteboards/:id`;
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
  const requiredScope = requiredScopeForEndpoint(method, pathname);
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
            : "append";

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

    if (pathname === "/cli/v1/whiteboards" && method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? 20);
      const documentIdParam = url.searchParams.get("documentId");
      const whiteboards = await ctx.runQuery(internal.cli.searchCliWhiteboards, {
        userId: auth.userId,
        documentId: documentIdParam
          ? (documentIdParam as Id<"documents">)
          : undefined,
        limit: Number.isFinite(limit) ? limit : 20,
      });
      return auditedSuccess({ whiteboards });
    }

    if (pathname === "/cli/v1/whiteboards" && method === "POST") {
      const body = await parseJsonBody(req);
      if (typeof body.title !== "string" || body.title.trim().length === 0) {
        return auditedError(422, "VALIDATION_ERROR", "title is required");
      }
      const dsl = parseWhiteboardDslBody(body.dsl);
      const whiteboard = await ctx.runMutation(internal.cli.createCliWhiteboard, {
        userId: auth.userId,
        title: body.title.trim(),
        documentId:
          typeof body.documentId === "string"
            ? (body.documentId as Id<"documents">)
            : undefined,
        dsl,
      });
      return auditedSuccess(whiteboard, { status: 201 });
    }

    const whiteboardPrefix = "/cli/v1/whiteboards/";
    if (pathname.startsWith(whiteboardPrefix)) {
      const suffix = pathname.slice(whiteboardPrefix.length);
      const [rawWhiteboardId, action] = suffix.split("/");
      const whiteboardId = decodeURIComponent(rawWhiteboardId) as Id<"whiteboards">;
      if (!whiteboardId) {
        return auditedError(422, "VALIDATION_ERROR", "whiteboard id is required");
      }

      if (method === "GET" && !action) {
        const whiteboard = await ctx.runQuery(internal.cli.getCliWhiteboard, {
          userId: auth.userId,
          whiteboardId,
        });
        if (!whiteboard) {
          return auditedError(404, "NOT_FOUND", "Whiteboard not found");
        }
        return auditedSuccess(whiteboard);
      }

      if (method === "PATCH" && !action) {
        const body = await parseJsonBody(req);
        const dsl = parseWhiteboardDslBody(body.dsl);
        const whiteboard = await ctx.runMutation(internal.cli.updateCliWhiteboard, {
          userId: auth.userId,
          whiteboardId,
          title: typeof body.title === "string" ? body.title : undefined,
          dsl,
          sceneJson:
            typeof body.sceneJson === "string" ? body.sceneJson : undefined,
        });
        if (!whiteboard) {
          return auditedError(404, "NOT_FOUND", "Whiteboard not found");
        }
        return auditedSuccess(whiteboard);
      }

      if (method === "POST" && action === "export") {
        const body = await parseJsonBody(req);
        const format = body.format === "json" || body.format === "svg" || body.format === "package"
          ? body.format
          : "json";
        const whiteboard = await ctx.runQuery(internal.cli.getCliWhiteboard, {
          userId: auth.userId,
          whiteboardId,
        });
        if (!whiteboard) {
          return auditedError(404, "NOT_FOUND", "Whiteboard not found");
        }
        const svg = createWhiteboardSvg(whiteboard.title, whiteboard.sceneJson);
        const content =
          format === "json"
            ? whiteboard.sceneJson
            : format === "svg"
              ? svg
              : JSON.stringify(
                  {
                    version: 1,
                    whiteboard: {
                      id: whiteboard.id,
                      title: whiteboard.title,
                      engine: whiteboard.engine,
                      sourceDslVersion: whiteboard.sourceDslVersion,
                      exportedAt: Date.now(),
                    },
                    files: [
                      {
                        path: "scene.json",
                        mimeType: "application/json",
                        content: whiteboard.sceneJson,
                      },
                      {
                        path: "thumbnail.txt",
                        mimeType: "text/plain",
                        content: whiteboard.thumbnailDataUrl ?? "",
                      },
                      {
                        path: "whiteboard.svg",
                        mimeType: "image/svg+xml",
                        content: svg,
                      },
                    ],
                  },
                  null,
                  2,
                );
        return auditedSuccess({
          id: whiteboard.id,
          title: whiteboard.title,
          format,
          content,
        });
      }

      if (method === "DELETE" && !action) {
        const whiteboard = await ctx.runMutation(internal.cli.archiveCliWhiteboard, {
          userId: auth.userId,
          whiteboardId,
        });
        if (!whiteboard) {
          return auditedError(404, "NOT_FOUND", "Whiteboard not found");
        }
        return auditedSuccess(whiteboard);
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

http.route({
  path: "/cli/v1/whiteboards",
  method: "GET",
  handler: cliHttpAction,
});

http.route({
  path: "/cli/v1/whiteboards",
  method: "POST",
  handler: cliHttpAction,
});

http.route({
  pathPrefix: "/cli/v1/whiteboards/",
  method: "GET",
  handler: cliHttpAction,
});

http.route({
  pathPrefix: "/cli/v1/whiteboards/",
  method: "PATCH",
  handler: cliHttpAction,
});

http.route({
  pathPrefix: "/cli/v1/whiteboards/",
  method: "POST",
  handler: cliHttpAction,
});

http.route({
  pathPrefix: "/cli/v1/whiteboards/",
  method: "DELETE",
  handler: cliHttpAction,
});

export default http;
