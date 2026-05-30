import { test, expect, type Page } from "@playwright/test";

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

async function openAIChat(page: Page) {
  await page.goto("/documents");
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: "Notion AI" }).click();
  await expect(page.getByText(/对话记录|Conversation History/)).toBeVisible();
}

async function mockAgentStream(page: Page, events: unknown[], status = 200, headers = {}) {
  await page.route("**/api/agent/stream", async (route) => {
    await route.fulfill({
      status,
      headers: {
        "Content-Type": "application/x-ndjson",
        ...headers,
      },
      body: events.map((event) => JSON.stringify(event)).join("\n") + "\n",
    });
  });
}

async function sendAIMessage(page: Page, message: string) {
  await page.getByPlaceholder(/使用 AI 处理各种任务|Use AI to handle various tasks/).fill(message);
  await page.keyboard.press("Enter");
  await expect(page.getByText(message)).toBeVisible();
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

test.describe("Web - AI Chat mock E2E", () => {
  test("completes a mocked conversation and displays read-only tool results above the answer", async ({
    page,
  }) => {
    await mockAgentStream(page, [
      { type: "tool-call-start", toolCallId: "tool-1", toolName: "knowledge_search" },
      { type: "tool-call-delta", toolCallId: "tool-1", delta: "{\"query\":\"Agent\"}" },
      {
        type: "tool-call-result",
        toolCallId: "tool-1",
        result: {
          query: "Agent",
          strategy: "balanced",
          documents: [
            {
              documentId: "doc1",
              title: "Agent 架构说明",
              score: 0.91,
              content: "Agent 架构说明内容",
              sources: ["semantic", "keyword"],
            },
          ],
        },
      },
      { type: "text-delta", id: "assistant", delta: "这是 mock 回答。" },
      { type: "finish", model: "deepseek-v4-pro", usage: null },
    ]);

    await openAIChat(page);
    await sendAIMessage(page, "帮我检索 Agent 架构");

    await expect(page.getByText(/知识库检索|Knowledge search/)).toBeVisible();
    await expect(page.getByText("Agent 架构说明")).toBeVisible();
    await expect(page.getByText("这是 mock 回答。")).toBeVisible();
  });

  test("shows document write confirmation preview for write tools", async ({ page }) => {
    await mockAgentStream(page, [
      {
        type: "tool-call-start",
        toolCallId: "tool-write",
        toolName: "document_write",
      },
      {
        type: "tool-call-result",
        toolCallId: "tool-write",
        result: {
          dryRun: true,
          confirmationRequired: true,
          action: "document_write",
          document: {
            title: "E2E 生成文档",
            contentMarkdown: "# E2E 标题\n这是一段预览内容。",
          },
        },
      },
      { type: "text-delta", id: "assistant", delta: "已生成文档预览，请确认。" },
      { type: "finish", model: "deepseek-v4-pro", usage: null },
    ]);

    await openAIChat(page);
    await sendAIMessage(page, "帮我创建一篇 E2E 文档");

    await expect(page.getByText(/文档创建预览|Document create preview/)).toBeVisible();
    await expect(page.getByText("E2E 生成文档")).toBeVisible();
    await expect(page.getByText(/需要用户确认后才会写入文档|User confirmation is required before writing the document/)).toBeVisible();
    await expect(page.getByRole("button", { name: /应用变更|Apply changes/ })).toBeVisible();
  });

  test("renders a recoverable error message when the mocked stream fails", async ({ page }) => {
    await mockAgentStream(page, [
      { type: "error", message: "mock stream failed" },
    ]);

    await openAIChat(page);
    await sendAIMessage(page, "触发错误");

    await expect(page.getByText("Sorry, something went wrong. Please try again.")).toBeVisible();
  });

  test("renders a recoverable error message for mocked 429 retry-after", async ({ page }) => {
    await mockAgentStream(page, [], 429, { "Retry-After": "9" });

    await openAIChat(page);
    await sendAIMessage(page, "触发限流");

    await expect(page.getByText("Sorry, something went wrong. Please try again.")).toBeVisible();
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
