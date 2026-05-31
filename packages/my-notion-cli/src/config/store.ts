import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type {
  AuthMethod,
  CliConfig,
  CliConfigV2,
  CliProfileConfig,
  ResolvedProfile,
} from "../types.js";

const CONFIG_PATH = join(homedir(), ".my-notion", "config.json");
export const DEFAULT_API_URL = "https://laudable-albatross-174.convex.site";
export const DEFAULT_WEB_URL = "https://notion-j9zj.vercel.app";
export const DEFAULT_PROFILE = "prod";
export const DEFAULT_LOCAL_PROFILE = "local";
export const DEFAULT_LOCAL_WEB_URL = "http://localhost:3000";

export function getTokenSetupMessage() {
  return [
    "Missing API token.",
    "Run `my-notion auth login` and open the browser authorization link.",
    "For local debugging use `my-notion auth login --profile local --web-url http://localhost:3000 --api-url <convex-site-url>`.",
    `The CLI will save it locally at ${CONFIG_PATH} and reuse it for later commands.`,
  ].join(" ");
}

export function getConfigPath() {
  return CONFIG_PATH;
}

export function loadConfig(): CliConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as CliConfig;
  } catch {
    return createEmptyConfig();
  }
}

export function saveConfig(config: CliConfig) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function createEmptyConfig(): CliConfigV2 {
  return {
    version: 2,
    activeProfile: DEFAULT_PROFILE,
    profiles: {},
  };
}

export function isConfigV2(config: CliConfig): config is CliConfigV2 {
  return (config as CliConfigV2).version === 2 && "profiles" in config;
}

export function normalizeApiUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function normalizeWebUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function migrateConfig(config: CliConfig): CliConfigV2 {
  if (isConfigV2(config)) {
    return {
      version: 2,
      activeProfile: config.activeProfile ?? DEFAULT_PROFILE,
      profiles: config.profiles ?? {},
    };
  }

  const legacyProfile: CliProfileConfig = {
    apiUrl: config.apiUrl ? normalizeApiUrl(config.apiUrl) : DEFAULT_API_URL,
    webUrl: DEFAULT_WEB_URL,
    token: config.token,
    authMethod: config.token ? "legacy-token" : undefined,
    updatedAt: Date.now(),
  };

  return {
    version: 2,
    activeProfile: DEFAULT_PROFILE,
    profiles: {
      [DEFAULT_PROFILE]: legacyProfile,
    },
  };
}

export function loadConfigV2(): CliConfigV2 {
  return migrateConfig(loadConfig());
}

export function saveConfigV2(config: CliConfigV2) {
  saveConfig(config);
}

export function resolveProfileName(options: Record<string, string | boolean>) {
  if (options.local === true) return DEFAULT_LOCAL_PROFILE;
  return (
    readStringOption(options, "profile") ??
    process.env.MY_NOTION_PROFILE ??
    loadConfigV2().activeProfile ??
    DEFAULT_PROFILE
  );
}

function defaultWebUrlForProfile(profile: string) {
  return profile === DEFAULT_LOCAL_PROFILE ? DEFAULT_LOCAL_WEB_URL : DEFAULT_WEB_URL;
}

function defaultApiUrlForProfile(_profile: string) {
  return DEFAULT_API_URL;
}

export function resolveProfile(
  options: Record<string, string | boolean>,
): ResolvedProfile {
  const name = resolveProfileName(options);
  const config = loadConfigV2();
  const saved = config.profiles[name] ?? {};
  const apiUrl =
    readStringOption(options, "api-url") ??
    process.env.MY_NOTION_API_URL ??
    saved.apiUrl ??
    defaultApiUrlForProfile(name);
  const webUrl =
    readStringOption(options, "web-url") ??
    process.env.MY_NOTION_WEB_URL ??
    saved.webUrl ??
    defaultWebUrlForProfile(name);
  const token =
    readStringOption(options, "token") ??
    process.env.MY_NOTION_API_TOKEN ??
    saved.token;

  return {
    name,
    apiUrl: normalizeApiUrl(apiUrl),
    webUrl: normalizeWebUrl(webUrl),
    token,
    tokenPrefix: saved.tokenPrefix,
    scopes: saved.scopes,
    expiresAt: saved.expiresAt,
    authMethod: saved.authMethod,
  };
}

export function saveProfileAuth(input: {
  profileName: string;
  apiUrl: string;
  webUrl: string;
  token: string;
  tokenPrefix?: string;
  scopes?: string[];
  expiresAt?: number | null;
  authMethod: AuthMethod;
}) {
  const config = loadConfigV2();
  const nextConfig: CliConfigV2 = {
    ...config,
    activeProfile: input.profileName,
    profiles: {
      ...config.profiles,
      [input.profileName]: {
        ...config.profiles[input.profileName],
        apiUrl: normalizeApiUrl(input.apiUrl),
        webUrl: normalizeWebUrl(input.webUrl),
        token: input.token,
        tokenPrefix: input.tokenPrefix,
        scopes: input.scopes,
        expiresAt: input.expiresAt,
        authMethod: input.authMethod,
        updatedAt: Date.now(),
      },
    },
  };
  saveConfigV2(nextConfig);
  return nextConfig.profiles[input.profileName];
}

export function clearSavedToken(options: Record<string, string | boolean> = {}) {
  const profileName = resolveProfileName(options);
  const config = loadConfigV2();
  const { token: _token, ...rest } = config.profiles[profileName] ?? {};
  const nextConfig: CliConfigV2 = {
    ...config,
    profiles: {
      ...config.profiles,
      [profileName]: rest,
    },
  };
  saveConfig(nextConfig);
  return {
    profileName,
    profile: nextConfig.profiles[profileName],
    config: nextConfig,
  };
}

export function resolveApiUrl(options: Record<string, string | boolean>) {
  return resolveProfile(options).apiUrl;
}

export function resolveWebUrl(options: Record<string, string | boolean>) {
  return resolveProfile(options).webUrl;
}

export function resolveToken(options: Record<string, string | boolean>) {
  const value = resolveProfile(options).token;

  if (!value) {
    throw new Error(getTokenSetupMessage());
  }

  return value;
}

export function readStringOption(
  options: Record<string, string | boolean>,
  name: string,
) {
  const value = options[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
