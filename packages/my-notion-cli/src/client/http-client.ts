import type { ApiResponse, ApiTokenResult, DocumentResult } from "../types.js";

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
    const response = await fetch(`${this.apiUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok || !payload?.success) {
      const code = payload?.success === false ? payload.error?.code : undefined;
      const requestId =
        payload?.requestId ?? response.headers.get("x-request-id") ?? undefined;
      const message =
        payload?.success === false
          ? payload.error?.message ?? code ?? "Request failed"
          : `HTTP ${response.status}`;
      throw new MyNotionApiError(message, response.status, code, requestId);
    }

    return payload.data;
  }
}
