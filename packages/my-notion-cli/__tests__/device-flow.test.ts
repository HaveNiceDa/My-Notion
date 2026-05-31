import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeviceLogin } from "../src/auth/device-flow.js";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
let tempDir: string;

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...init.headers },
    status: init.status ?? 200,
  });
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "my-notion-cli-device-"));
  process.env = {
    ...originalEnv,
    MY_NOTION_CONFIG_PATH: join(tempDir, "config.json"),
  };
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  process.env = originalEnv;
  globalThis.fetch = originalFetch;
  rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("device authorization flow", () => {
  it("keeps the device code out of printed authorization URLs", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          deviceCode: "mnd_secret_device_code",
          userCode: "ABCD-EFGH",
          verificationUri: "http://localhost:3000/cli/auth",
          verificationUriComplete:
            "http://localhost:3000/cli/auth?user_code=ABCD-EFGH",
          expiresAt: Date.now() + 60_000,
          intervalSeconds: 3,
        },
      }),
    );
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await runDeviceLogin({
      positionals: ["auth", "login"],
      options: {
        "no-wait": true,
        profile: "local",
        "web-url": "http://localhost:3000",
        "api-url": "https://local.convex.site",
      },
    });

    const printed = consoleSpy.mock.calls.flat().join("\n");
    expect(result).toMatchObject({
      pending: true,
      profile: "local",
      deviceCode: "mnd_secret_device_code",
      verificationUriComplete:
        "http://localhost:3000/cli/auth?user_code=ABCD-EFGH",
    });
    expect(printed).toContain("http://localhost:3000/cli/auth?user_code=ABCD-EFGH");
    expect(printed).not.toContain("mnd_secret_device_code");
    expect(printed).not.toContain("device_code=");
  });
});
