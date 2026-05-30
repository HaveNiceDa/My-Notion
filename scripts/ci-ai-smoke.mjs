#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const root = new URL("..", import.meta.url).pathname;
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const requireE2E = process.env.AI_SMOKE_REQUIRE_E2E === "1";
const skipE2E = process.env.AI_SMOKE_SKIP_E2E === "1";

const steps = [
  {
    name: "Web unit",
    command: "pnpm",
    args: [
      "--filter",
      "@notion/web",
      "exec",
      "vitest",
      "run",
      "src/components/ai-chat/ai-chat-components.test.ts",
      "src/components/ai-chat/stream-client.test.ts",
    ],
  },
  {
    name: "Agent unit",
    command: "pnpm",
    args: [
      "--filter",
      "@notion/web",
      "exec",
      "vitest",
      "run",
      "src/lib/agent/__tests__",
    ],
  },
  {
    name: "Retrieval eval",
    command: "pnpm",
    args: ["eval:retrieval"],
  },
];

async function main() {
  for (const step of steps) {
    runStep(step);
  }

  await runAiChatMockE2E();
  console.log("\n[AI Smoke] completed");
}

function runStep({ name, command, args, env }) {
  console.log(`\n[AI Smoke] ${name}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function runAiChatMockE2E() {
  console.log("\n[AI Smoke] AI Chat mock E2E");

  if (skipE2E) {
    console.log("[AI Smoke] skipped: AI_SMOKE_SKIP_E2E=1");
    return;
  }

  if (!process.env.CLERK_SECRET_KEY) {
    const message = "CLERK_SECRET_KEY is required for authenticated AI Chat mock E2E";
    if (requireE2E) {
      throw new Error(message);
    }
    console.log(`[AI Smoke] skipped: ${message}`);
    console.log("[AI Smoke] set CLERK_SECRET_KEY locally to run authenticated E2E");
    return;
  }

  let server;
  const serverAlreadyRunning = await isUrlReady(baseUrl);
  if (!serverAlreadyRunning) {
    if (process.env.AI_SMOKE_START_SERVER === "0") {
      throw new Error(`${baseUrl} is not reachable and AI_SMOKE_START_SERVER=0`);
    }
    server = startWebServer();
    await waitForUrl(baseUrl, 60_000);
  }

  try {
    runStep({
      name: "AI Chat mock E2E",
      command: "pnpm",
      args: [
        "exec",
        "playwright",
        "test",
        "tests/web/api-auth.spec.ts",
        "--project=chromium-authenticated",
        "--grep",
        "Web - AI Chat mock E2E",
        "--reporter=list",
      ],
      // playwright.config.ts hides the authenticated project when CI is truthy.
      env: { CI: "", PLAYWRIGHT_BASE_URL: baseUrl },
    });
  } finally {
    if (server) {
      server.kill("SIGTERM");
    }
  }
}

function startWebServer() {
  console.log(`[AI Smoke] starting @notion/web dev server at ${baseUrl}`);
  const child = spawn("pnpm", ["--filter", "@notion/web", "dev"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`[AI Smoke] web server exited with code ${code}`);
    }
    if (signal) {
      console.error(`[AI Smoke] web server stopped by ${signal}`);
    }
  });

  return child;
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isUrlReady(url)) return;
    await sleep(1_000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function isUrlReady(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.status < 500;
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
