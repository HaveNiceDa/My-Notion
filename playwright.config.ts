import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testDir: "./tests/web",
      testIgnore: /auth-setup\.spec\.ts|api-auth\.spec\.ts/,
    },
    ...(!isCI
      ? [
          {
            name: "auth-setup",
            testMatch: /auth-setup\.spec\.ts/ as RegExp,
            testDir: "./tests/web",
            use: { ...devices["Desktop Chrome"] },
          },
          {
            name: "chromium-authenticated",
            testMatch: /api-auth\.spec\.ts/ as RegExp,
            testDir: "./tests/web",
            use: {
              ...devices["Desktop Chrome"],
              storageState: ".auth/storage-state.json",
            },
            dependencies: ["auth-setup"],
          },
        ]
      : []),
  ],
});
