import { test, expect } from "@playwright/test";

test.describe("Web - Editor AI API", () => {
  test("editor-ai/streamText endpoint rejects GET requests", async ({
    page,
  }) => {
    const response = await page.goto("/api/editor-ai/streamText");
    expect(response).toBeDefined();
    expect([401, 405, 400]).toContain(response!.status());
  });

  test("editor-ai/streamText endpoint requires authentication for POST", async ({
    page,
  }) => {
    await page.goto("/");
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/editor-ai/streamText", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], toolDefinitions: {} }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect([401, 400]).toContain(response.status);
  });

  test("editor-ai/streamText returns error for invalid body", async ({
    page,
  }) => {
    await page.goto("/");
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/editor-ai/streamText", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return { status: res.status, body: await res.json() };
    });
    expect([401, 400]).toContain(response.status);
  });
});
