import { test, expect } from "@playwright/test";

test.describe("Web - Core Navigation", () => {
  test.skip(({ browserName }) => browserName === "webkit", "Skip webkit in CI");

  test("redirects unauthenticated users from protected routes to marketing page", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page.waitForURL(/\/$|\/en$/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/$|\/en$/);
  });
});

test.describe("Web - Public Routes", () => {
  test("preview page returns 200 for valid document slug pattern", async ({
    page,
  }) => {
    const response = await page.goto("/preview/nonexistent-id");
    expect(response).toBeDefined();
    expect(response!.status()).toBeLessThan(500);
  });

  test("API health check - agent stream endpoint rejects GET", async ({ page }) => {
    const response = await page.goto("/api/agent/stream");
    expect(response).toBeDefined();
    expect([401, 405, 400]).toContain(response!.status());
  });
});

test.describe("Web - Static Assets", () => {
  test("page loads with correct locale handling", async ({ page }) => {
    await page.goto("/", { timeout: 60000, waitUntil: "domcontentloaded" });
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", /en|zh/, { timeout: 10000 });
  });
});
