import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_API_URL = "https://moonlit-ptarmigan-478.convex.site";
export const DEFAULT_PROFILE = "prod";
export const DEFAULT_LOCAL_PROFILE = "local";

const DEFAULT_CONFIG_FILE = "config.json";
const LOCAL_CONFIG_FILE = "config.local.json";

type CliProfileConfig = {
  apiUrl?: string;
  token?: string;
};

type CliConfigV1 = {
  apiUrl?: string;
  token?: string;
};

type CliConfigV2 = {
  version: 2;
  profiles: Record<string, CliProfileConfig>;
};

export type ResolveOptions = Record<string, string | boolean>;

export function readStringOption(options: ResolveOptions, name: string) {
  const value = options[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function normalizeApiUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function resolveProfileName(options: ResolveOptions = {}) {
  if (options.local === true) return DEFAULT_LOCAL_PROFILE;
  return (
    readStringOption(options, "profile") ??
    process.env.MY_NOTION_PROFILE ??
    DEFAULT_PROFILE
  );
}

function configFileForProfile(profileName: string) {
  return profileName === DEFAULT_LOCAL_PROFILE ? LOCAL_CONFIG_FILE : DEFAULT_CONFIG_FILE;
}

export function getConfigPath(profileName = DEFAULT_PROFILE) {
  return (
    process.env.MY_NOTION_CONFIG_PATH ??
    join(homedir(), ".local", "share", "my-notion", configFileForProfile(profileName))
  );
}

function loadConfig(profileName = DEFAULT_PROFILE): CliConfigV1 | CliConfigV2 {
  try {
    return JSON.parse(readFileSync(getConfigPath(profileName), "utf8")) as CliConfigV1 | CliConfigV2;
  } catch {
    return { version: 2, profiles: {} };
  }
}

function isConfigV2(config: CliConfigV1 | CliConfigV2): config is CliConfigV2 {
  return (config as CliConfigV2).version === 2 && "profiles" in config;
}

export function resolveApiUrl(options: ResolveOptions = {}) {
  const profileName = resolveProfileName(options);
  const config = loadConfig(profileName);
  const saved = isConfigV2(config) ? config.profiles[profileName] : config;
  const apiUrl =
    readStringOption(options, "api-url") ??
    process.env.MY_NOTION_API_URL ??
    saved?.apiUrl ??
    DEFAULT_API_URL;

  return normalizeApiUrl(apiUrl);
}

export function getTokenSetupMessage(profileName = DEFAULT_PROFILE) {
  return [
    "Missing API token.",
    "Run `my-notion auth login` and open the browser authorization link.",
    "For MCP usage, install and start `my-notion-mcp-server --transport stdio` after CLI auth is configured.",
    `The token is read from ${getConfigPath(profileName)} or MY_NOTION_API_TOKEN.`,
  ].join(" ");
}

export function resolveToken(options: ResolveOptions = {}) {
  const profileName = resolveProfileName(options);
  const config = loadConfig(profileName);
  const saved = isConfigV2(config) ? config.profiles[profileName] : config;
  const token =
    readStringOption(options, "token") ??
    process.env.MY_NOTION_API_TOKEN ??
    saved?.token;

  if (!token) {
    throw new Error(getTokenSetupMessage(profileName));
  }

  return token;
}
