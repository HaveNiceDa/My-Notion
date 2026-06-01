import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedArgs } from "../src/types.js";

const output = vi.hoisted(() => ({
  writeOutput: vi.fn(),
}));

vi.mock("../src/format/output.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/format/output.js")>();
  return {
    ...actual,
    writeOutput: output.writeOutput,
  };
});

const originalEnv = { ...process.env };
let tempDir: string;
let configPath: string;

function args(options: ParsedArgs["options"] = {}): ParsedArgs {
  return {
    positionals: ["config", "init"],
    options,
  };
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "my-notion-cli-config-command-"));
  configPath = join(tempDir, "config.json");
  process.env = { ...originalEnv, MY_NOTION_CONFIG_PATH: configPath };
  delete process.env.MY_NOTION_API_URL;
  delete process.env.MY_NOTION_WEB_URL;
  delete process.env.MY_NOTION_API_TOKEN;
  output.writeOutput.mockClear();
});

afterEach(() => {
  process.env = originalEnv;
  rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("runConfigCommand", () => {
  it("initializes the prod profile without requiring a token", async () => {
    const { runConfigCommand } = await import("../src/commands/config.js");

    await runConfigCommand(args({ format: "json" }));

    expect(output.writeOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        initialized: true,
        profile: expect.objectContaining({
          name: "prod",
          apiUrl: "https://laudable-albatross-174.convex.site",
          webUrl: "https://notion-j9zj.vercel.app",
          tokenConfigured: false,
          configPath,
        }),
        commands: expect.objectContaining({
          login: "my-notion auth login",
          agentLogin: "my-notion auth login --no-open",
          installSkills: "npx skills add @mynotion/cli -y -g",
          mcpServe: "my-notion mcp serve --transport stdio",
        }),
      }),
      "json",
    );

    const saved = JSON.parse(readFileSync(configPath, "utf8")) as {
      profiles: Record<string, { apiUrl?: string; webUrl?: string; token?: string }>;
    };
    expect(saved.profiles.prod).toMatchObject({
      apiUrl: "https://laudable-albatross-174.convex.site",
      webUrl: "https://notion-j9zj.vercel.app",
    });
    expect(saved.profiles.prod.token).toBeUndefined();
  });

  it("keeps token values out of command output", async () => {
    const { saveProfileAuth } = await import("../src/config/store.js");
    const { runConfigCommand } = await import("../src/commands/config.js");
    saveProfileAuth({
      profileName: "prod",
      apiUrl: "https://saved.convex.site",
      webUrl: "https://saved.example.com",
      token: "mnt_secret",
      authMethod: "device",
    });

    await runConfigCommand(args({ format: "json" }));

    const [summary] = output.writeOutput.mock.calls[0] ?? [];
    expect(summary).toEqual(
      expect.objectContaining({
        ok: true,
        ready: true,
        profile: expect.objectContaining({
          tokenConfigured: true,
        }),
      }),
    );
    expect(JSON.stringify(summary)).not.toContain("mnt_secret");
  });

  it("supports local dry-run checks without writing config", async () => {
    const { runConfigCommand } = await import("../src/commands/config.js");

    await runConfigCommand(
      args({
        local: true,
        "dry-run": true,
        "api-url": "https://dev.convex.site/",
        "web-url": "http://localhost:3000/",
        format: "json",
      }),
    );

    expect(output.writeOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        initialized: false,
        profile: expect.objectContaining({
          name: "local",
          apiUrl: "https://dev.convex.site",
          webUrl: "http://localhost:3000",
        }),
        commands: expect.objectContaining({
          login:
            "my-notion auth login --local --web-url http://localhost:3000 --api-url https://dev.convex.site",
          agentLogin:
            "my-notion auth login --no-open --local --web-url http://localhost:3000 --api-url https://dev.convex.site",
        }),
      }),
      "json",
    );

    expect(() => readFileSync(configPath, "utf8")).toThrow();
  });
});
