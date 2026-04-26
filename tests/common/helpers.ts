import { Page } from "@playwright/test";

export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `screenshots/${name}.png` });
}

export async function waitForApiReady(page: Page, endpoint: string): Promise<boolean> {
  try {
    const response = await page.goto(endpoint);
    return response !== null && response.status() < 500;
  } catch {
    return false;
  }
}
