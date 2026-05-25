import { expect, test } from "@playwright/test";

type CreateTokenBody = {
  name?: string;
  scopes?: string[];
  expiresAt?: number;
};

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

test.describe("Web - PAT settings", () => {
  test("creates PAT with selected scopes and validates expiration time", async ({
    context,
    page,
  }) => {
    const createRequests: CreateTokenBody[] = [];
    let tokenCreated = false;
    await context.grantPermissions(["clipboard-write"]);

    await page.route("**/api/cli/tokens", async (route) => {
      const request = route.request();

      if (request.method() === "GET") {
        const tokens = tokenCreated
          ? [
              {
                id: "token_1",
                name: "Playwright PAT",
                tokenPrefix: "mnt_test123",
                scopes: createRequests[0]?.scopes ?? [],
                createdAt: Date.now(),
                lastUsedAt: null,
                expiresAt: createRequests[0]?.expiresAt ?? null,
                revokedAt: null,
              },
            ]
          : [];

        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: { tokens } }),
        });
        return;
      }

      if (request.method() === "POST") {
        const body = request.postDataJSON() as CreateTokenBody;
        createRequests.push(body);
        tokenCreated = true;

        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "token_1",
              token: "mnt_plaintext_token_for_playwright",
              tokenPrefix: "mnt_test123",
            },
          }),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto("/en/test-pat-settings");
    await expect(page.getByRole("dialog", { name: "My settings" })).toBeVisible();

    const createButton = page.getByRole("button", { name: "Create token" });
    const docsReadScope = page.getByRole("checkbox", { name: /docs:read/ });
    const docsWriteScope = page.getByRole("checkbox", { name: /docs:write/ });
    const expirationInput = page.getByLabel("Expiration time");

    await docsReadScope.click();
    await docsWriteScope.click();
    await createButton.click();
    expect(createRequests).toHaveLength(0);

    await docsReadScope.click();
    await expirationInput.fill("2000-01-01T00:00");
    await createButton.click();
    expect(createRequests).toHaveLength(0);

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await expirationInput.fill(toDateTimeLocalValue(future));
    await page
      .getByPlaceholder("Token name, e.g. Work laptop CLI")
      .fill("Playwright PAT");
    await createButton.click();

    await expect(page.getByText("New token created")).toBeVisible();
    expect(createRequests).toHaveLength(1);
    expect(createRequests[0]).toMatchObject({
      name: "Playwright PAT",
      scopes: ["docs:read"],
    });
    expect(createRequests[0].expiresAt).toBeGreaterThan(Date.now());

    await page.getByRole("button", { name: "Copy" }).click();
    await page.getByRole("checkbox", {
      name: "I have copied and saved this token securely.",
    }).click();
    await page.getByRole("button", { name: "I saved it, hide token" }).click();
    await expect(page.getByText("New token created")).toBeHidden();
  });
});
