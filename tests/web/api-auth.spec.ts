import { test, expect } from "@playwright/test";

async function apiPost(
  page: import("@playwright/test").Page,
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const result = await page.evaluate(
    async ({ path, body }) => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    },
    { path, body },
  );
  return result;
}

test.describe("Web - API Routes (Authenticated POST)", () => {
  test("POST /api/rag-documents with initKnowledgeBaseVectorStore returns non-500", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const { status, body } = await apiPost(page, "/api/rag-documents", {
      action: "initKnowledgeBaseVectorStore",
    });
    expect(status).toBeLessThan(500);
    expect(body).toHaveProperty("success");
  });

  test("POST /api/rag-documents with invalid action returns 400", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const { status, body } = await apiPost(page, "/api/rag-documents", {
      action: "invalidAction",
    });
    expect(status).toBe(400);
    expect((body as Record<string, unknown>).success).toBe(false);
    expect((body as Record<string, unknown>).error).toContain("Invalid action");
  });

  test("POST /api/chat with valid messages returns non-401", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const status = await page.evaluate(async () => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello" }],
          model: "default",
        }),
      });
      res.body?.cancel();
      return res.status;
    });
    expect(status).not.toBe(401);
  });

  test("POST /api/chat without messages returns 400", async ({ page }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await apiPost(page, "/api/chat", {});
    expect(status).toBe(400);
  });

  test("POST /api/embeddings with input returns non-500", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const { status, body } = await apiPost(page, "/api/embeddings", {
      input: "test embedding input",
    });
    expect(status).toBeLessThan(500);
    if (status === 200) {
      expect(body).toHaveProperty("embedding");
    }
  });

  test("POST /api/embeddings without input returns 400", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await apiPost(page, "/api/embeddings", {});
    expect(status).toBe(400);
  });

  test("POST /api/qdrant with ensureCollectionExists returns non-500", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await apiPost(page, "/api/qdrant", {
      action: "ensureCollectionExists",
    });
    expect(status).toBeLessThan(500);
  });

  test("POST /api/qdrant with invalid action returns 400", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await apiPost(page, "/api/qdrant", {
      action: "invalidAction",
    });
    expect(status).toBe(400);
  });

  test("POST /api/rag-stream with query returns non-401", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const status = await page.evaluate(async () => {
      const res = await fetch("/api/rag-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "test query", model: "default" }),
      });
      res.body?.cancel();
      return res.status;
    });
    expect(status).not.toBe(401);
  });

  test("POST /api/rag-stream without query returns 400", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await apiPost(page, "/api/rag-stream", {});
    expect(status).toBe(400);
  });

  test("POST /api/rag-complete with runRAGQuery returns non-500", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await apiPost(page, "/api/rag-complete", {
      action: "runRAGQuery",
      query: "test query",
      model: "default",
    });
    expect(status).toBeLessThan(500);
  });

  test("POST /api/rag-complete with invalid action returns 400", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await apiPost(page, "/api/rag-complete", {
      action: "invalidAction",
    });
    expect(status).toBe(400);
  });

  test("POST /api/upload-image without file returns non-401", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const result = await page.evaluate(async () => {
      const res = await fetch("/api/upload-image", { method: "POST" });
      return { status: res.status, body: await res.json() };
    });
    expect(result.status).not.toBe(401);
  });
});

test.describe("Web - API Routes (Unauthenticated POST)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("POST /api/rag-documents returns 401 without auth", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await page.evaluate(async () => {
      const res = await fetch("/api/rag-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initKnowledgeBaseVectorStore" }),
      });
      return { status: res.status };
    });
    expect(status).toBe(401);
  });

  test("POST /api/chat returns 401 without auth", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await page.evaluate(async () => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
      });
      return { status: res.status };
    });
    expect(status).toBe(401);
  });

  test("POST /api/embeddings returns 401 without auth", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await page.evaluate(async () => {
      const res = await fetch("/api/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "test" }),
      });
      return { status: res.status };
    });
    expect(status).toBe(401);
  });

  test("POST /api/qdrant returns 401 without auth", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await page.evaluate(async () => {
      const res = await fetch("/api/qdrant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensureCollectionExists" }),
      });
      return { status: res.status };
    });
    expect(status).toBe(401);
  });

  test("POST /api/rag-stream returns 401 without auth", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await page.evaluate(async () => {
      const res = await fetch("/api/rag-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "test" }),
      });
      return { status: res.status };
    });
    expect(status).toBe(401);
  });

  test("POST /api/rag-complete returns 401 without auth", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await page.evaluate(async () => {
      const res = await fetch("/api/rag-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "runRAGQuery", query: "test" }),
      });
      return { status: res.status };
    });
    expect(status).toBe(401);
  });

  test("POST /api/upload-image returns 401 without auth", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await page.evaluate(async () => {
      const res = await fetch("/api/upload-image", { method: "POST" });
      return { status: res.status };
    });
    expect(status).toBe(401);
  });
});
