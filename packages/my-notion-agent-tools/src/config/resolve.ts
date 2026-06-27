import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_API_URL = "https://moonlit-ptarmigan-478.convex.site";
export const DEFAULT_WEB_URL = "https://notion-j9zj.vercel.app";
export const DEFAULT_PROFILE = "prod";
export const DEFAULT_LOCAL_PROFILE = "local";
export const DEFAULT_LOCAL_WEB_URL = "http://localhost:3000";

const DEFAULT_CONFIG_FILE = "config.json";
const LOCAL_CONFIG_FILE = "config.local.json";

type CliProfileConfig = {
  apiUrl?: string;
  webUrl?: string;
  token?: string;
  tokenPrefix?: string;
  authMethod?: string;
  expiresAt?: number | null;
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
export type ConfigValueSource =
  | "flag"
  | "profile-env"
  | "env"
  | "config"
  | "default"
  | "missing";
export type RuntimeEnvironment = "prod" | "local" | "custom";
export type ResolvedMyNotionProfile = {
  name: string;
  environment: RuntimeEnvironment;
  local: boolean;
  apiUrl: string;
  webUrl: string;
  token?: string;
  tokenPrefix?: string;
  authMethod?: string;
  expiresAt?: number | null;
  configPath: string;
  sources: {
    profile: ConfigValueSource;
    apiUrl: ConfigValueSource;
    webUrl: ConfigValueSource;
    token: ConfigValueSource;
  };
};

export function readStringOption(options: ResolveOptions, name: string) {
  const value = options[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function normalizeApiUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function resolveProfileName(options: ResolveOptions = {}) {
  return resolveProfileNameWithSource(options).name;
}

function resolveProfileNameWithSource(options: ResolveOptions = {}) {
  if (options.local === true) {
    return { name: DEFAULT_LOCAL_PROFILE, source: "flag" as const };
  }

  const profileOption = readStringOption(options, "profile");
  if (profileOption) {
    return { name: profileOption, source: "flag" as const };
  }

  return { name: DEFAULT_PROFILE, source: "default" as const };
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

function getDefaultWebUrlForProfile(profileName: string) {
  return profileName === DEFAULT_LOCAL_PROFILE ? DEFAULT_LOCAL_WEB_URL : DEFAULT_WEB_URL;
}

function getRuntimeEnvironment(profileName: string): RuntimeEnvironment {
  if (profileName === DEFAULT_LOCAL_PROFILE) return "local";
  if (profileName === DEFAULT_PROFILE) return "prod";
  return "custom";
}

function getProfileEnvName(profileName: string, suffix: string) {
  return `MY_NOTION_${profileName.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${suffix}`;
}

function readEnvForProfile(profileName: string, suffix: string, fallbackName: string) {
  const profileValue = process.env[getProfileEnvName(profileName, suffix)];
  if (profileValue) {
    return { value: profileValue, source: "profile-env" as const };
  }

  const fallbackValue = process.env[fallbackName];
  if (fallbackValue) {
    return { value: fallbackValue, source: "env" as const };
  }

  return undefined;
}

function resolveStringSetting(input: {
  optionValue?: string;
  envValue?: { value: string; source: ConfigValueSource };
  configValue?: string;
  defaultValue?: string;
}) {
  if (input.optionValue) return { value: input.optionValue, source: "flag" as const };
  if (input.envValue) return input.envValue;
  if (input.configValue) return { value: input.configValue, source: "config" as const };
  if (input.defaultValue) return { value: input.defaultValue, source: "default" as const };
  return { value: undefined, source: "missing" as const };
}

export function resolveProfile(options: ResolveOptions = {}): ResolvedMyNotionProfile {
  const { name: profileName, source: profileSource } = resolveProfileNameWithSource(options);
  const config = loadConfig(profileName);
  const savedV2 = isConfigV2(config) ? config.profiles[profileName] : undefined;
  const savedV1 = isConfigV2(config) ? undefined : config;
  const useSavedEndpoint = profileName !== DEFAULT_PROFILE;
  const savedApiUrl = useSavedEndpoint ? savedV2?.apiUrl ?? savedV1?.apiUrl : undefined;
  const savedWebUrl = useSavedEndpoint ? savedV2?.webUrl : undefined;
  const savedToken = savedV2?.token ?? savedV1?.token;
  const apiUrl = resolveStringSetting({
    optionValue: readStringOption(options, "api-url"),
    envValue: readEnvForProfile(profileName, "API_URL", "MY_NOTION_API_URL"),
    configValue: savedApiUrl,
    defaultValue: DEFAULT_API_URL,
  });
  const webUrl = resolveStringSetting({
    optionValue: readStringOption(options, "web-url"),
    envValue: readEnvForProfile(profileName, "WEB_URL", "MY_NOTION_WEB_URL"),
    configValue: savedWebUrl,
    defaultValue: getDefaultWebUrlForProfile(profileName),
  });
  const token = resolveStringSetting({
    optionValue: readStringOption(options, "token"),
    envValue: readEnvForProfile(profileName, "API_TOKEN", "MY_NOTION_API_TOKEN"),
    configValue: savedToken,
  });

  return {
    name: profileName,
    environment: getRuntimeEnvironment(profileName),
    local: profileName === DEFAULT_LOCAL_PROFILE,
    apiUrl: normalizeApiUrl(apiUrl.value ?? DEFAULT_API_URL),
    webUrl: (webUrl.value ?? getDefaultWebUrlForProfile(profileName)).replace(/\/+$/, ""),
    token: token.value,
    tokenPrefix: savedV2?.tokenPrefix,
    authMethod: savedV2?.authMethod,
    expiresAt: savedV2?.expiresAt,
    configPath: getConfigPath(profileName),
    sources: {
      profile: profileSource,
      apiUrl: apiUrl.source,
      webUrl: webUrl.source,
      token: token.source,
    },
  };
}

export function resolveApiUrl(options: ResolveOptions = {}) {
  return resolveProfile(options).apiUrl;
}

export function getTokenSetupMessage(profileName = DEFAULT_PROFILE) {
  const loginCommand =
    profileName === DEFAULT_LOCAL_PROFILE
      ? "my-notion auth login --local"
      : profileName === DEFAULT_PROFILE
        ? "my-notion auth login"
        : `my-notion auth login --profile ${profileName}`;
  return [
    "Missing API token.",
    `Run \`${loginCommand}\` and open the browser authorization link.`,
    "For MCP usage, install and start `my-notion-mcp --transport stdio` after CLI auth is configured.",
    `The token is read from ${getConfigPath(profileName)} or MY_NOTION_API_TOKEN.`,
  ].join(" ");
}

export function resolveToken(options: ResolveOptions = {}) {
  const profile = resolveProfile(options);

  if (!profile.token) {
    throw new Error(getTokenSetupMessage(profile.name));
  }

  return profile.token;
}
