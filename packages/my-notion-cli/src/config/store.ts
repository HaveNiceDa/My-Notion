import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, userInfo } from "node:os";
import { basename, dirname, join } from "node:path";
import type {
  AuthMethod,
  CliConfig,
  CliConfigV2,
  CliProfileConfig,
  ConfigValueSource,
  ResolvedProfile,
  RuntimeEnvironment,
} from "../types.js";

export const DEFAULT_API_URL = "https://moonlit-ptarmigan-478.convex.site";
export const DEFAULT_WEB_URL = "https://notion-j9zj.vercel.app";
export const DEFAULT_PROFILE = "prod";
export const DEFAULT_LOCAL_PROFILE = "local";
export const DEFAULT_LOCAL_WEB_URL = "http://localhost:3000";
const DEFAULT_CONFIG_FILE = "config.json";
const LOCAL_CONFIG_FILE = "config.local.json";

export class ConfigStoreError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ConfigStoreError";
  }
}

export function getTokenSetupMessage(profileName = DEFAULT_PROFILE) {
  return [
    "Missing API token.",
    "Run `my-notion auth login` and open the browser authorization link.",
    "For local debugging use `my-notion auth login --local --web-url http://localhost:3000 --api-url <convex-site-url>`.",
    `The CLI will save it locally at ${getConfigPath(profileName)} and reuse it for later commands.`,
  ].join(" ");
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

export function getConfigDir(profileName = DEFAULT_PROFILE) {
  return dirname(getConfigPath(profileName));
}

export function loadConfig(profileName = DEFAULT_PROFILE): CliConfig {
  try {
    return JSON.parse(readFileSync(getConfigPath(profileName), "utf8")) as CliConfig;
  } catch {
    return createEmptyConfig();
  }
}

function createConfigStoreError(error: unknown, action: string, profileName = DEFAULT_PROFILE) {
  const path = getConfigPath(profileName);
  const dir = getConfigDir(profileName);
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;
  const causeMessage = error instanceof Error ? error.message : String(error);
  const username = userInfo().username;
  const repairHints = [
    `Failed to ${action} My-Notion CLI config at ${path}.`,
    `Current user: ${username}.`,
    `Cause: ${causeMessage}.`,
    "Suggested repair:",
    `  mkdir -p "${dir}"`,
    `  chown -R "$(id -un)" "${dir}"`,
    `  chmod 700 "${dir}"`,
    `  [ ! -e "${path}" ] || chmod 600 "${path}"`,
    "On macOS, inspect file flags and extended attributes with:",
    `  ls -lO@ "${dir}" "${path}"`,
    "If you confirm an extended attribute is blocking writes, remove it explicitly, for example:",
    `  xattr -d com.apple.provenance "${path}"`,
    "For CI or isolated debugging, set MY_NOTION_CONFIG_PATH to another writable config file.",
  ];

  return new ConfigStoreError(repairHints.join("\n"), code);
}

function bestEffortChmod(path: string, mode: number) {
  try {
    chmodSync(path, mode);
  } catch {
    // Permission repair is best-effort; the later write/rename will surface a detailed error.
  }
}

export function saveConfig(config: CliConfig, profileName = DEFAULT_PROFILE) {
  const path = getConfigPath(profileName);
  const dir = dirname(path);
  const tempPath = join(
    dir,
    `.${basename(path)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    bestEffortChmod(dir, 0o700);
    writeFileSync(tempPath, JSON.stringify(config, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    bestEffortChmod(tempPath, 0o600);
    renameSync(tempPath, path);
    bestEffortChmod(path, 0o600);
  } catch (error) {
    try {
      rmSync(tempPath, { force: true });
    } catch {
      // Ignore cleanup errors and preserve the original write failure.
    }
    throw createConfigStoreError(error, "save", profileName);
  }
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

export function loadConfigV2(profileName = DEFAULT_PROFILE): CliConfigV2 {
  return migrateConfig(loadConfig(profileName));
}

export function saveConfigV2(config: CliConfigV2, profileName = DEFAULT_PROFILE) {
  saveConfig(config, profileName);
}

function resolveProfileNameWithSource(
  options: Record<string, string | boolean>,
): { name: string; source: ConfigValueSource } {
  if (options.local === true) {
    return { name: DEFAULT_LOCAL_PROFILE, source: "flag" };
  }

  const profileOption = readStringOption(options, "profile");
  if (profileOption) {
    return { name: profileOption, source: "flag" };
  }

  return { name: DEFAULT_PROFILE, source: "default" };
}

export function resolveProfileName(options: Record<string, string | boolean>) {
  return resolveProfileNameWithSource(options).name;
}

export function getDefaultWebUrlForProfile(profile: string) {
  return profile === DEFAULT_LOCAL_PROFILE ? DEFAULT_LOCAL_WEB_URL : DEFAULT_WEB_URL;
}

export function getDefaultApiUrlForProfile(_profile: string) {
  return DEFAULT_API_URL;
}

function getProfileEnvName(profileName: string, suffix: string) {
  return `MY_NOTION_${profileName.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${suffix}`;
}

function readEnvForProfile(profileName: string, suffix: string, fallbackName: string) {
  const profileEnvName = getProfileEnvName(profileName, suffix);
  const profileValue = process.env[profileEnvName];
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
  if (input.optionValue) {
    return { value: input.optionValue, source: "flag" as const };
  }
  if (input.envValue) {
    return input.envValue;
  }
  if (input.configValue) {
    return { value: input.configValue, source: "config" as const };
  }
  if (input.defaultValue) {
    return { value: input.defaultValue, source: "default" as const };
  }
  return { value: undefined, source: "missing" as const };
}

function getRuntimeEnvironment(profileName: string): RuntimeEnvironment {
  if (profileName === DEFAULT_LOCAL_PROFILE) return "local";
  if (profileName === DEFAULT_PROFILE) return "prod";
  return "custom";
}

export function resolveProfile(
  options: Record<string, string | boolean>,
): ResolvedProfile {
  const { name, source: profileSource } = resolveProfileNameWithSource(options);
  const config = loadConfigV2(name);
  const saved = config.profiles[name] ?? {};
  const apiUrl = resolveStringSetting({
    optionValue: readStringOption(options, "api-url"),
    envValue: readEnvForProfile(name, "API_URL", "MY_NOTION_API_URL"),
    configValue: saved.apiUrl,
    defaultValue: getDefaultApiUrlForProfile(name),
  });
  const webUrl = resolveStringSetting({
    optionValue: readStringOption(options, "web-url"),
    envValue: readEnvForProfile(name, "WEB_URL", "MY_NOTION_WEB_URL"),
    configValue: saved.webUrl,
    defaultValue: getDefaultWebUrlForProfile(name),
  });
  const token = resolveStringSetting({
    optionValue: readStringOption(options, "token"),
    envValue: readEnvForProfile(name, "API_TOKEN", "MY_NOTION_API_TOKEN"),
    configValue: saved.token,
  });

  return {
    name,
    environment: getRuntimeEnvironment(name),
    local: name === DEFAULT_LOCAL_PROFILE,
    apiUrl: normalizeApiUrl(apiUrl.value ?? getDefaultApiUrlForProfile(name)),
    webUrl: normalizeWebUrl(webUrl.value ?? getDefaultWebUrlForProfile(name)),
    token: token.value,
    tokenPrefix: saved.tokenPrefix,
    scopes: saved.scopes,
    expiresAt: saved.expiresAt,
    authMethod: saved.authMethod,
    configPath: getConfigPath(name),
    sources: {
      profile: profileSource,
      apiUrl: apiUrl.source,
      webUrl: webUrl.source,
      token: token.source,
    },
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
  const config = loadConfigV2(input.profileName);
  const nextConfig: CliConfigV2 = {
    ...config,
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
  saveConfigV2(nextConfig, input.profileName);
  return nextConfig.profiles[input.profileName];
}

export function saveProfileConfig(input: {
  profileName: string;
  apiUrl: string;
  webUrl: string;
}) {
  const config = loadConfigV2(input.profileName);
  const nextConfig: CliConfigV2 = {
    ...config,
    activeProfile: input.profileName,
    profiles: {
      ...config.profiles,
      [input.profileName]: {
        ...config.profiles[input.profileName],
        apiUrl: normalizeApiUrl(input.apiUrl),
        webUrl: normalizeWebUrl(input.webUrl),
        updatedAt: Date.now(),
      },
    },
  };
  saveConfigV2(nextConfig, input.profileName);
  return nextConfig.profiles[input.profileName];
}

export function clearSavedToken(options: Record<string, string | boolean> = {}) {
  const profileName = resolveProfileName(options);
  const config = loadConfigV2(profileName);
  const { token: _token, ...rest } = config.profiles[profileName] ?? {};
  const nextConfig: CliConfigV2 = {
    ...config,
    profiles: {
      ...config.profiles,
      [profileName]: rest,
    },
  };
  saveConfig(nextConfig, profileName);
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
  const profile = resolveProfile(options);
  const value = profile.token;

  if (!value) {
    throw new Error(getTokenSetupMessage(profile.name));
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
