import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
let tempHome: string;

async function loadStore() {
  vi.resetModules();
  vi.doMock("node:os", () => ({
    homedir: () => tempHome,
    userInfo: () => ({ username: "test-user" }),
  }));
  return import("../src/config/store.js");
}

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "my-notion-cli-config-"));
  process.env = { ...originalEnv, HOME: tempHome };
  delete process.env.MY_NOTION_API_URL;
  delete process.env.MY_NOTION_API_TOKEN;
  delete process.env.MY_NOTION_PROFILE;
  delete process.env.MY_NOTION_LOCAL_API_URL;
  delete process.env.MY_NOTION_LOCAL_API_TOKEN;
  delete process.env.MY_NOTION_PROD_API_URL;
  delete process.env.MY_NOTION_PROD_API_TOKEN;
  delete process.env.MY_NOTION_CONFIG_PATH;
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

  it("prefers profile-specific environment variables over legacy generic env", async () => {
    const store = await loadStore();

    process.env.MY_NOTION_API_URL = "https://generic.convex.site/";
    process.env.MY_NOTION_API_TOKEN = "mnt_generic";
    process.env.MY_NOTION_LOCAL_API_URL = "https://local.convex.site/";
    process.env.MY_NOTION_LOCAL_API_TOKEN = "mnt_local";

    expect(store.resolveProfile({ local: true })).toMatchObject({
      name: "local",
      environment: "local",
      apiUrl: "https://local.convex.site",
      token: "mnt_local",
      sources: {
        apiUrl: "profile-env",
        token: "profile-env",
      },
    });
    expect(store.resolveProfile({})).toMatchObject({
      name: "prod",
      environment: "prod",
      apiUrl: "https://generic.convex.site",
      token: "mnt_generic",
      sources: {
        apiUrl: "env",
        token: "env",
      },
    });
  });

  it("does not switch to local from environment without an explicit flag", async () => {
    const store = await loadStore();

    process.env.MY_NOTION_PROFILE = "local";
    process.env.MY_NOTION_LOCAL_API_URL = "https://local.convex.site/";
    process.env.MY_NOTION_LOCAL_API_TOKEN = "mnt_local";
    process.env.MY_NOTION_PROD_API_URL = "https://prod.convex.site/";
    process.env.MY_NOTION_PROD_API_TOKEN = "mnt_prod";

    expect(store.resolveProfile({})).toMatchObject({
      name: "prod",
      environment: "prod",
      apiUrl: "https://prod.convex.site",
      token: "mnt_prod",
      sources: {
        profile: "default",
        apiUrl: "profile-env",
        token: "profile-env",
      },
    });
    expect(store.resolveProfile({ local: true })).toMatchObject({
      name: "local",
      environment: "local",
      apiUrl: "https://local.convex.site",
      token: "mnt_local",
      sources: {
        profile: "flag",
        apiUrl: "profile-env",
        token: "profile-env",
      },
    });
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

    expect(store.resolveApiUrl({})).toBe("https://moonlit-ptarmigan-478.convex.site");
    expect(() => store.resolveToken({})).toThrow("my-notion auth login");
    expect(() => store.resolveToken({})).toThrow(".local/share/my-notion/config.json");
  });

  it("uses the sandbox-friendly local share path by default", async () => {
    const store = await loadStore();

    expect(store.getConfigPath()).toBe(
      join(tempHome, ".local", "share", "my-notion", "config.json"),
    );
    expect(store.getConfigPath("local")).toBe(
      join(tempHome, ".local", "share", "my-notion", "config.local.json"),
    );
  });

  it("keeps local and prod login state in separate config files", async () => {
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
    expect(store.resolveProfile({})).toMatchObject({
      name: "prod",
      apiUrl: "https://prod.convex.site",
      token: "mnt_prod",
    });
    expect(store.loadConfigV2()).toMatchObject({
      profiles: {
        prod: {
          token: "mnt_prod",
        },
      },
    });
    expect(store.loadConfigV2("local")).toMatchObject({
      profiles: {
        local: {
          token: "mnt_local",
        },
      },
    });
  });

  it("supports overriding the config path for isolated environments", async () => {
    const customPath = join(tempHome, "custom", "my-notion.json");
    process.env.MY_NOTION_CONFIG_PATH = customPath;
    const store = await loadStore();

    store.saveConfig({
      apiUrl: "https://custom.convex.site",
      token: "mnt_custom",
    });

    expect(store.getConfigPath()).toBe(customPath);
    expect(store.resolveProfile({})).toMatchObject({
      apiUrl: "https://custom.convex.site",
      token: "mnt_custom",
    });
  });

  it("writes config with private directory and file permissions", async () => {
    const store = await loadStore();

    store.saveConfig({
      apiUrl: "https://secure.convex.site",
      token: "mnt_secure",
    });

    const dirMode = statSync(store.getConfigDir()).mode & 0o777;
    const fileMode = statSync(store.getConfigPath()).mode & 0o777;
    expect(dirMode).toBe(0o700);
    expect(fileMode).toBe(0o600);
  });

  it("surfaces actionable repair guidance when config writes fail", async () => {
    const store = await loadStore();
    process.env.MY_NOTION_CONFIG_PATH = "/dev/null/config.json";
    const saveBrokenConfig = () =>
      store.saveConfig({
        apiUrl: "https://broken.convex.site",
        token: "mnt_broken",
      });

    expect(saveBrokenConfig).toThrow("Suggested repair");
    expect(saveBrokenConfig).toThrow("MY_NOTION_CONFIG_PATH");
  });
});
