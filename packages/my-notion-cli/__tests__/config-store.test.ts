import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
let tempHome: string;

async function loadStore() {
  vi.resetModules();
  vi.doMock("node:os", () => ({
    homedir: () => tempHome,
  }));
  return import("../src/config/store.js");
}

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "my-notion-cli-config-"));
  process.env = { ...originalEnv, HOME: tempHome };
  delete process.env.MY_NOTION_API_URL;
  delete process.env.MY_NOTION_API_TOKEN;
});

afterEach(() => {
  vi.doUnmock("node:os");
  process.env = originalEnv;
  rmSync(tempHome, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("config store", () => {
  it("resolves command flags before environment and saved config", async () => {
    const store = await loadStore();

    store.saveConfig({
      apiUrl: "https://saved.convex.site/",
      token: "mnt_saved",
    });
    process.env.MY_NOTION_API_URL = "https://env.convex.site/";
    process.env.MY_NOTION_API_TOKEN = "mnt_env";

    expect(
      store.resolveApiUrl({
        "api-url": "https://flag.convex.site/",
      }),
    ).toBe("https://flag.convex.site");
    expect(store.resolveToken({ token: "mnt_flag" })).toBe("mnt_flag");
  });

  it("falls back to environment variables before saved config", async () => {
    const store = await loadStore();

    store.saveConfig({
      apiUrl: "https://saved.convex.site",
      token: "mnt_saved",
    });
    process.env.MY_NOTION_API_URL = "https://env.convex.site/";
    process.env.MY_NOTION_API_TOKEN = "mnt_env";

    expect(store.resolveApiUrl({})).toBe("https://env.convex.site");
    expect(store.resolveToken({})).toBe("mnt_env");
  });

  it("uses saved config and can clear only the saved token", async () => {
    const store = await loadStore();

    store.saveConfig({
      apiUrl: "https://saved.convex.site/",
      token: "mnt_saved",
    });

    expect(store.resolveApiUrl({})).toBe("https://saved.convex.site");
    expect(store.resolveToken({})).toBe("mnt_saved");
    expect(store.clearSavedToken()).toEqual({
      apiUrl: "https://saved.convex.site/",
    });
    expect(store.loadConfig()).toEqual({
      apiUrl: "https://saved.convex.site/",
    });
  });

  it("uses the default online API URL and still requires a token", async () => {
    const store = await loadStore();

    expect(store.resolveApiUrl({})).toBe("https://handsome-stoat-500.convex.site");
    expect(() => store.resolveToken({})).toThrow("Missing API token");
  });
});
