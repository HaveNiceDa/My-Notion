import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["packages/*/src/**/*.test.ts", "packages/*/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "packages/*/server/**/*.ts"],
      exclude: ["**/*.d.ts", "**/index.ts"],
    },
  },
});
