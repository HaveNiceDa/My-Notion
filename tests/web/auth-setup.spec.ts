import { test, expect } from "@playwright/test";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY!;
const E2E_USER_EMAIL = process.env.E2E_CLERK_USER_EMAIL || "shijieli02@163.com";
const E2E_USER_PASSWORD = process.env.E2E_CLERK_USER_PASSWORD || "@1280063538Ss";

async function createClerkSessionViaApi(): Promise<string> {
  const usersRes = await fetch("https://api.clerk.com/v1/users?limit=10&email_address=" + encodeURIComponent(E2E_USER_EMAIL), {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  if (!usersRes.ok) {
    throw new Error(`Failed to fetch Clerk users: ${usersRes.status}`);
  }
  const users = await usersRes.json();
  const userList = Array.isArray(users) ? users : users.data;
  const targetUser = userList.find((u: { email_addresses: Array<{ email_address: string }> }) =>
    u.email_addresses.some((e: { email_address: string }) => e.email_address === E2E_USER_EMAIL)
  );
  if (!targetUser) {
    throw new Error(`User ${E2E_USER_EMAIL} not found in Clerk`);
  }

  const sessionRes = await fetch("https://api.clerk.com/v1/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: targetUser.id }),
  });
  if (!sessionRes.ok) {
    throw new Error(`Failed to create session: ${sessionRes.status} ${await sessionRes.text()}`);
  }
  const session = await sessionRes.json();

  const tokenRes = await fetch(`https://api.clerk.com/v1/sessions/${session.id}/tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!tokenRes.ok) {
    throw new Error(`Failed to create token: ${tokenRes.status}`);
  }
  const tokenData = await tokenRes.json();
  return tokenData.jwt;
}

test.describe("Auth Setup", () => {
  test("authenticate via Clerk UI and save storage state", async ({ page, context }) => {
    test.setTimeout(120000);

    await page.goto("/en");
    await page.waitForLoadState("networkidle");

    const loginButton = page.getByRole("button", { name: /login/i }).first();
    await loginButton.waitFor({ state: "visible", timeout: 15000 });
    await loginButton.click();

    const identifierInput = page.locator("input[name='identifier']").first();
    await identifierInput.waitFor({ state: "visible", timeout: 15000 });
    await identifierInput.fill(E2E_USER_EMAIL);

    const passwordInput = page.locator("input[name='password']").first();
    await passwordInput.waitFor({ state: "visible", timeout: 10000 });
    await passwordInput.fill(E2E_USER_PASSWORD);

    const submitBtn = page.locator("button:visible").filter({ hasText: /continue/i }).first();
    await submitBtn.click();

    await page.waitForTimeout(5000);

    const currentUrl = page.url();

    if (currentUrl.includes("documents")) {
      await context.storageState({ path: ".auth/storage-state.json" });
      return;
    }

    const jwt = await createClerkSessionViaApi();

    await context.addCookies([
      {
        name: "__client_uat",
        value: "1",
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
      {
        name: "__session",
        value: jwt,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/en/documents");
    await page.waitForLoadState("networkidle");

    const authCheck = await page.evaluate(async () => {
      const res = await fetch("/api/rag-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initKnowledgeBaseVectorStore" }),
      });
      return res.status;
    });

    if (authCheck === 401) {
      await page.evaluate((token) => {
        document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax`;
      }, jwt);

      await page.reload();
      await page.waitForLoadState("networkidle");

      const retryCheck = await page.evaluate(async () => {
        const res = await fetch("/api/rag-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "initKnowledgeBaseVectorStore" }),
        });
        return res.status;
      });
      expect(retryCheck).not.toBe(401);
    }

    await context.storageState({ path: ".auth/storage-state.json" });
  });
});
