import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { CliConfig } from "../types.js";

const CONFIG_PATH = join(homedir(), ".my-notion", "config.json");
export const DEFAULT_API_URL = "https://laudable-albatross-174.convex.site";

export function getTokenSetupMessage() {
  return [
    "Missing API token.",
    "Open My-Notion Web -> Settings -> API Token, show/copy your default CLI token, then run:",
    "my-notion auth login --token <mnt_token>",
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
    return {};
  }
}

export function saveConfig(config: CliConfig) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function clearSavedToken() {
  const { token: _token, ...rest } = loadConfig();
  const nextConfig: CliConfig = rest;
  saveConfig(nextConfig);
  return nextConfig;
}

export function resolveApiUrl(options: Record<string, string | boolean>) {
  const value =
    readStringOption(options, "api-url") ??
    process.env.MY_NOTION_API_URL ??
    loadConfig().apiUrl ??
    DEFAULT_API_URL;

  return value.replace(/\/+$/, "");
}

export function resolveToken(options: Record<string, string | boolean>) {
  const value =
    readStringOption(options, "token") ??
    process.env.MY_NOTION_API_TOKEN ??
    loadConfig().token;

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
