import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@notion/ai": path.resolve(__dirname, "../../packages/ai"),
      "@notion/ai/server": path.resolve(__dirname, "../../packages/ai/server/index.ts"),
      "@notion/ai/utils": path.resolve(__dirname, "../../packages/ai/utils/index.ts"),
      "@notion/ai/config": path.resolve(__dirname, "../../packages/ai/config/index.ts"),
      "@notion/business": path.resolve(__dirname, "../../packages/business/src"),
    },
  },
});
