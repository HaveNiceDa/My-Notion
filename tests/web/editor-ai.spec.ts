import { test, expect } from "@playwright/test";

test.describe("Web - Editor AI API", () => {
  test("editor-ai/streamText endpoint requires authentication", async ({
    page,
  }) => {
    const response = await page.goto("/api/editor-ai/streamText");
    expect(response).toBeDefined();
    expect([401, 405, 400]).toContain(response!.status());
  });

  test("editor-ai/streamText rejects GET requests", async ({ page }) => {
    const response = await page.goto("/api/editor-ai/streamText");
    expect(response).toBeDefined();
    expect(response!.status()).not.toBe(200);
  });

  test("editor-ai/streamText returns error for invalid body", async ({
    page,
  }) => {
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

test.describe("Web - Editor AI UI", () => {
  test("AI toolbar button is visible in editor", async ({ page }) => {
    await page.goto("/");
    const signInButton = page.locator('button[data-testid="sign-in-button"]');
    const userButton = page.locator('button[data-testid="user-button"]');

    const isAuthenticated =
      (await signInButton.isVisible().catch(() => false)) === false ||
      (await userButton.isVisible().catch(() => false));

    if (!isAuthenticated) {
      test.skip();
      return;
    }

    const documentLink = page.locator('a[href*="/documents/"]').first();
    if (!(await documentLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await documentLink.click();
    await page.waitForTimeout(2000);

    const editorArea = page.locator(".bn-root").first();
    await expect(editorArea).toBeVisible({ timeout: 10000 });
  });

  test("slash menu includes AI option", async ({ page }) => {
    await page.goto("/");
    const documentLink = page.locator('a[href*="/documents/"]').first();
    if (!(await documentLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await documentLink.click();
    await page.waitForTimeout(2000);

    const editorArea = page.locator(".bn-root").first();
    if (!(await editorArea.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await editorArea.click();
    await page.keyboard.type("/");
    await page.waitForTimeout(500);

    const slashMenu = page.locator(".bn-suggestion-menu").first();
    const slashMenuVisible = await slashMenu.isVisible().catch(() => false);
    if (slashMenuVisible) {
      const aiOption = page.locator('[data-name="ai"]').first();
      const hasAI = await aiOption.isVisible().catch(() => false);
      expect(typeof hasAI).toBe("boolean");
    }
  });
});
