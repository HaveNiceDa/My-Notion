import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      { find: "@notion/ai/server", replacement: path.resolve(__dirname, "../../packages/ai/server/index.ts") },
      { find: "@notion/ai/utils", replacement: path.resolve(__dirname, "../../packages/ai/utils/index.ts") },
      { find: "@notion/ai/config", replacement: path.resolve(__dirname, "../../packages/ai/config/index.ts") },
      { find: "@notion/ai", replacement: path.resolve(__dirname, "../../packages/ai") },
      { find: "@notion/business", replacement: path.resolve(__dirname, "../../packages/business/src") },
    ],
  },
});
