import type {
  ApiResponse,
  ApiTokenResult,
  DocumentResult,
  WhiteboardExportResult,
  WhiteboardResult,
} from "../types.js";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;
const DNS_FAMILY_ATTEMPT_TIMEOUT_MS = 1_000;

setDefaultAutoSelectFamilyAttemptTimeout(DNS_FAMILY_ATTEMPT_TIMEOUT_MS);

function getAuthRecoveryMessage(code?: string) {
  if (code === "TOKEN_EXPIRED") {
    return "Saved CLI token has expired. Run `my-notion auth login` and approve the browser authorization link.";
  }

  if (code === "TOKEN_REVOKED") {
    return "Saved CLI token was revoked. Run `my-notion auth login` and approve the browser authorization link.";
  }

  if (code === "UNAUTHORIZED") {
    return "CLI token is invalid or missing. Run `my-notion auth login` and approve the browser authorization link.";
  }

  return undefined;
}

export class MyNotionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string,
  ) {
    super(requestId ? `${message} (requestId: ${requestId})` : message);
    this.name = "MyNotionApiError";
  }
}

type ClientOptions = {
  apiUrl: string;
  token: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableApiError(error: MyNotionApiError) {
  if (error.code === "RATE_LIMITED") {
    return false;
  }
  return error.status === 0 || isRetryableStatus(error.status);
}

function retryDelay(attempt: number) {
  return RETRY_BASE_DELAY_MS * 2 ** attempt;
}

export class MyNotionClient {
  private readonly apiUrl: string;
  private readonly token: string;

  constructor(options: ClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/+$/, "");
    this.token = options.token;
  }

  authStatus() {
    return this.request<{
      authenticated: boolean;
      tokenPrefix: string;
      scopes: string[];
      expiresAt: number | null;
    }>("/cli/v1/auth/status");
  }

  createDocument(input: { title: string; contentMarkdown?: string }) {
    return this.request<DocumentResult>("/cli/v1/documents", {
      method: "POST",
      body: input,
    });
  }

  fetchDocument(documentId: string) {
    return this.request<DocumentResult>(
      `/cli/v1/documents/${encodeURIComponent(documentId)}`,
    );
  }

  searchDocuments(input: { query?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (input.query) params.set("q", input.query);
    if (input.limit) params.set("limit", String(input.limit));
    const queryString = params.toString();

    return this.request<{ documents: DocumentResult[] }>(
      `/cli/v1/documents/search${queryString ? `?${queryString}` : ""}`,
    );
  }

  listDocuments(input: { limit?: number }) {
    const params = new URLSearchParams();
    if (input.limit) params.set("limit", String(input.limit));
    const queryString = params.toString();

    return this.request<{ documents: DocumentResult[] }>(
      `/cli/v1/documents${queryString ? `?${queryString}` : ""}`,
    );
  }

  createWhiteboard(input: {
    title: string;
    documentId?: string;
    dsl?: unknown;
  }) {
    return this.request<WhiteboardResult>("/cli/v1/whiteboards", {
      method: "POST",
      body: input,
    });
  }

  listWhiteboards(input: { documentId?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (input.documentId) params.set("documentId", input.documentId);
    if (input.limit) params.set("limit", String(input.limit));
    const queryString = params.toString();
    return this.request<{ whiteboards: WhiteboardResult[] }>(
      `/cli/v1/whiteboards${queryString ? `?${queryString}` : ""}`,
    );
  }

  fetchWhiteboard(whiteboardId: string) {
    return this.request<WhiteboardResult>(
      `/cli/v1/whiteboards/${encodeURIComponent(whiteboardId)}`,
    );
  }

  updateWhiteboard(input: {
    id: string;
    title?: string;
    dsl?: unknown;
    sceneJson?: string;
  }) {
    return this.request<WhiteboardResult>(
      `/cli/v1/whiteboards/${encodeURIComponent(input.id)}`,
      {
        method: "PATCH",
        body: {
          title: input.title,
          dsl: input.dsl,
          sceneJson: input.sceneJson,
        },
      },
    );
  }

  exportWhiteboard(input: { id: string; format: "json" | "svg" }) {
    return this.request<WhiteboardExportResult>(
      `/cli/v1/whiteboards/${encodeURIComponent(input.id)}/export`,
      {
        method: "POST",
        body: { format: input.format },
      },
    );
  }

  archiveWhiteboard(whiteboardId: string) {
    return this.request<WhiteboardResult>(
      `/cli/v1/whiteboards/${encodeURIComponent(whiteboardId)}`,
      {
        method: "DELETE",
      },
    );
  }

  updateDocument(input: {
    id: string;
    title?: string;
    contentMarkdown?: string;
    mode?: "overwrite" | "append";
  }) {
    return this.request<DocumentResult>(
      `/cli/v1/documents/${encodeURIComponent(input.id)}`,
      {
        method: "PATCH",
        body: {
          title: input.title,
          contentMarkdown: input.contentMarkdown,
          mode: input.mode,
        },
      },
    );
  }

  archiveDocument(documentId: string) {
    return this.request<DocumentResult>(
      `/cli/v1/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE",
      },
    );
  }

  revokeCurrentToken() {
    return this.request<{ token: ApiTokenResult }>("/cli/v1/tokens/revoke-current", {
      method: "POST",
    });
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ) {
    const method = options.method ?? "GET";
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    let lastError: MyNotionApiError | undefined;

    for (let attempt = 0; attempt < DEFAULT_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.requestOnce<T>(path, { method, body });
      } catch (error) {
        const apiError =
          error instanceof MyNotionApiError
            ? error
            : new MyNotionApiError(
                isAbortError(error)
                  ? `Request timed out after ${DEFAULT_TIMEOUT_MS}ms`
                  : error instanceof Error
                    ? error.message
                    : "Network request failed",
                0,
                isAbortError(error) ? "TIMEOUT" : "NETWORK_ERROR",
              );

        lastError = apiError;

        const shouldRetry =
          attempt < DEFAULT_MAX_ATTEMPTS - 1 && isRetryableApiError(apiError);
        if (!shouldRetry) {
          throw apiError;
        }

        await sleep(retryDelay(attempt));
      }
    }

    throw lastError ?? new MyNotionApiError("Request failed", 0, "NETWORK_ERROR");
  }

  private async requestOnce<T>(
    path: string,
    options: { method: string; body?: string },
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}${path}`, {
        method: options.method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: options.body,
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok || !payload?.success) {
      const code = payload?.success === false ? payload.error?.code : undefined;
      const requestId =
        payload?.requestId ?? response.headers.get("x-request-id") ?? undefined;
      const message =
        getAuthRecoveryMessage(code) ??
        (payload?.success === false
          ? payload.error?.message ?? code ?? "Request failed"
          : `HTTP ${response.status}`);
      throw new MyNotionApiError(message, response.status, code, requestId);
    }

    return payload.data;
  }
}
