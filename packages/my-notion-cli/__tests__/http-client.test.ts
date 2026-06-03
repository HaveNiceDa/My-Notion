import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyNotionApiError, MyNotionClient } from "../src/client/http-client.js";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    status: init.status ?? 200,
  });
}

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("MyNotionClient", () => {
  it("sends bearer auth, trims the API URL, and unwraps successful data", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          id: "doc_1",
          title: "Doc",
          content: "Body",
          contentMarkdown: "Body",
          contentFormat: "markdown",
          isArchived: false,
          isPublished: false,
          isInKnowledgeBase: true,
          lastEditedTime: 123,
        },
      }),
    );

    const client = new MyNotionClient({
      apiUrl: "https://example.convex.site///",
      token: "mnt_test",
    });
    const document = await client.createDocument({
      title: "Doc",
      contentMarkdown: "Body",
    });

    expect(document.id).toBe("doc_1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.convex.site/cli/v1/documents",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer mnt_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Doc", contentMarkdown: "Body" }),
      }),
    );
  });

  it("encodes document IDs and query parameters", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { documents: [] },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          id: "doc/id",
          title: "Doc",
          content: "",
          contentMarkdown: "",
          contentFormat: "markdown",
          isArchived: false,
          isPublished: false,
          isInKnowledgeBase: true,
          lastEditedTime: null,
        },
      }),
    );

    const client = new MyNotionClient({
      apiUrl: "https://example.convex.site",
      token: "mnt_test",
    });

    await client.searchDocuments({ query: "hello world", limit: 10 });
    await client.fetchDocument("doc/id");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.convex.site/cli/v1/documents/search?q=hello+world&limit=10",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.convex.site/cli/v1/documents/doc%2Fid",
      expect.any(Object),
    );
  });

  it("sends whiteboard DSL create and export requests", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          id: "wb_1",
          title: "Board",
          engine: "excalidraw",
          sceneJson: "{}",
          isArchived: false,
          createdAt: 1,
          updatedAt: 1,
        },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          id: "wb_1",
          title: "Board",
          format: "json",
          content: "{}",
        },
      }),
    );

    const client = new MyNotionClient({
      apiUrl: "https://example.convex.site",
      token: "mnt_test",
    });
    const dsl = {
      version: "mwb-dsl-v1",
      nodes: [{ id: "a", type: "box", text: "A" }],
    };

    await client.createWhiteboard({ title: "Board", documentId: "doc_1", dsl });
    await client.exportWhiteboard({ id: "wb_1", format: "json" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.convex.site/cli/v1/whiteboards",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Board", documentId: "doc_1", dsl }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.convex.site/cli/v1/whiteboards/wb_1/export",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ format: "json" }),
      }),
    );
  });

  it("does not retry structured rate limit errors and preserves requestId", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          requestId: "req_body",
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests",
          },
        },
        { status: 429 },
      ),
    );

    const client = new MyNotionClient({
      apiUrl: "https://example.convex.site",
      token: "mnt_test",
    });

    await expect(client.authStatus()).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      requestId: "req_body",
      message: expect.stringContaining("Too many requests"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient network failures before succeeding", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            authenticated: true,
            tokenPrefix: "mnt_prefix",
            scopes: ["docs:read"],
            expiresAt: null,
          },
        }),
      );

    const client = new MyNotionClient({
      apiUrl: "https://example.convex.site",
      token: "mnt_test",
    });
    const resultPromise = client.authStatus();

    await vi.advanceTimersByTimeAsync(300);

    await expect(resultPromise).resolves.toMatchObject({
      authenticated: true,
      tokenPrefix: "mnt_prefix",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses the response header requestId when the body omits it", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Document not found",
          },
        },
        {
          status: 404,
          headers: { "x-request-id": "req_header" },
        },
      ),
    );

    const client = new MyNotionClient({
      apiUrl: "https://example.convex.site",
      token: "mnt_test",
    });

    try {
      await client.fetchDocument("missing");
      throw new Error("Expected fetchDocument to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(MyNotionApiError);
      expect(error).toMatchObject({
        status: 404,
        code: "NOT_FOUND",
        requestId: "req_header",
      });
    }
  });

  it("turns stale token errors into actionable login guidance", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: {
            code: "TOKEN_EXPIRED",
            message: "Token expired",
          },
        },
        { status: 401 },
      ),
    );

    const client = new MyNotionClient({
      apiUrl: "https://example.convex.site",
      token: "mnt_old",
    });

    await expect(client.authStatus()).rejects.toMatchObject({
      status: 401,
      code: "TOKEN_EXPIRED",
      message: expect.stringContaining("my-notion auth login"),
    });
  });
});
