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

  test("POST /api/agent/stream with valid messages returns non-401", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const status = await page.evaluate(async () => {
      const res = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hello" }],
          modelId: "deepseek-v4-pro",
        }),
      });
      res.body?.cancel();
      return res.status;
    });
    expect(status).not.toBe(401);
  });

  test("POST /api/agent/stream without messages returns 400", async ({ page }) => {
    await page.goto("/documents");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await apiPost(page, "/api/agent/stream", {});
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

  test("POST /api/agent/stream returns 401 without auth", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const { status } = await page.evaluate(async () => {
      const res = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
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
