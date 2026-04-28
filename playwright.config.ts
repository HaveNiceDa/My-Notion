import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth-setup\.spec\.ts/,
      testDir: "./tests/web",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testDir: "./tests/web",
      testIgnore: /auth-setup\.spec\.ts|api-auth\.spec\.ts/,
      dependencies: ["auth-setup"],
    },
    {
      name: "chromium-authenticated",
      testMatch: /api-auth\.spec\.ts/,
      testDir: "./tests/web",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/storage-state.json",
      },
      dependencies: ["auth-setup"],
    },
  ],
});
