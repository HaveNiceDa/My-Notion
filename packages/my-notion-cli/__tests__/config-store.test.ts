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
    expect(store.clearSavedToken()).toMatchObject({
      profileName: "prod",
      profile: {
        apiUrl: "https://saved.convex.site",
        webUrl: "https://notion-j9zj.vercel.app",
      },
    });
    expect(store.loadConfigV2()).toMatchObject({
      version: 2,
      profiles: {
        prod: {
          apiUrl: "https://saved.convex.site",
          webUrl: "https://notion-j9zj.vercel.app",
        },
      },
    });
  });

  it("uses the default online API URL and still requires a token", async () => {
    const store = await loadStore();

    expect(store.resolveApiUrl({})).toBe("https://laudable-albatross-174.convex.site");
    expect(() => store.resolveToken({})).toThrow("my-notion auth login");
    expect(() => store.resolveToken({})).toThrow(".my-notion/config.json");
  });

  it("keeps local and prod profiles isolated", async () => {
    const store = await loadStore();

    store.saveProfileAuth({
      profileName: "prod",
      apiUrl: "https://prod.convex.site",
      webUrl: "https://prod.example.com",
      token: "mnt_prod",
      authMethod: "device",
    });
    store.saveProfileAuth({
      profileName: "local",
      apiUrl: "https://local.convex.site",
      webUrl: "http://localhost:3000",
      token: "mnt_local",
      authMethod: "device",
    });

    expect(store.resolveProfile({ profile: "prod" })).toMatchObject({
      name: "prod",
      apiUrl: "https://prod.convex.site",
      webUrl: "https://prod.example.com",
      token: "mnt_prod",
    });
    expect(store.resolveProfile({ local: true })).toMatchObject({
      name: "local",
      apiUrl: "https://local.convex.site",
      webUrl: "http://localhost:3000",
      token: "mnt_local",
    });
  });
});
