import { test, expect } from "@playwright/test";

test.describe("Web - API Routes", () => {
  test("upload-image endpoint requires POST", async ({ request }) => {
    const response = await request.get("/api/upload-image");
    expect([401, 405, 400]).toContain(response.status());
  });

  test("rag-documents endpoint requires POST", async ({ request }) => {
    const response = await request.get("/api/rag-documents");
    expect([401, 405, 400]).toContain(response.status());
  });

  test("agent stream endpoint requires POST", async ({ request }) => {
    const response = await request.get("/api/agent/stream");
    expect([401, 405, 400]).toContain(response.status());
  });

  test("edgestore proxy rejects unauthorized", async ({ request }) => {
    const response = await request.get("/api/edgestore/test");
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(600);
  });
});
