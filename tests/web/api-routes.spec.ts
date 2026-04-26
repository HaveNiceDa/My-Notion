import { test, expect } from "@playwright/test";

test.describe("Web - API Routes", () => {
  test("upload-image endpoint requires POST", async ({ page }) => {
    const response = await page.goto("/api/upload-image");
    expect(response).toBeDefined();
    expect([401, 405, 400]).toContain(response!.status());
  });

  test("rag-documents endpoint requires POST", async ({ page }) => {
    const response = await page.goto("/api/rag-documents");
    expect(response).toBeDefined();
    expect([401, 405, 400]).toContain(response!.status());
  });

  test("rag-complete endpoint requires POST", async ({ page }) => {
    const response = await page.goto("/api/rag-complete");
    expect(response).toBeDefined();
    expect([401, 405, 400]).toContain(response!.status());
  });

  test("qdrant endpoint requires POST", async ({ page }) => {
    const response = await page.goto("/api/qdrant");
    expect(response).toBeDefined();
    expect([401, 405, 400]).toContain(response!.status());
  });

  test("edgestore proxy rejects unauthorized", async ({ page }) => {
    const response = await page.goto("/api/edgestore/test");
    expect(response).toBeDefined();
    expect(response!.status()).toBeGreaterThanOrEqual(400);
  });
});
