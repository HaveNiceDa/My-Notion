import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LOCAL_PROFILE,
  getConfigPath,
  getDefaultApiUrlForProfile,
  getDefaultWebUrlForProfile,
  loadConfigV2,
  normalizeApiUrl,
  normalizeWebUrl,
  readStringOption,
  resolveProfileName,
  saveProfileConfig,
} from "../config/store.js";
import { getOutputFormat, writeOutput } from "../format/output.js";
import type { ParsedArgs } from "../types.js";

const PACKAGE_NAME = "@mynotion/cli";
const BINARY_NAME = "my-notion";
const SKILLS_INSTALL_COMMAND = "npx skills add @mynotion/cli -y -g";
const REQUIRED_NODE_MAJOR = 20;

type PackageInfo = {
  name?: string;
  version?: string;
};

function readPackageInfo(): PackageInfo {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const packagePath = join(currentDir, "..", "..", "package.json");
  try {
    return JSON.parse(readFileSync(packagePath, "utf8")) as PackageInfo;
  } catch {
    return {
      name: PACKAGE_NAME,
      version: "0.0.0",
    };
  }
}

function getSkillsPath() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return join(currentDir, "..", "..", "skills");
}

function getNodeCheck() {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  return {
    ok: major >= REQUIRED_NODE_MAJOR,
    current: process.versions.node,
    required: `>=${REQUIRED_NODE_MAJOR}`,
  };
}

function buildLoginCommand(input: {
  profileName: string;
  webUrl: string;
  apiUrl: string;
  noOpen?: boolean;
}) {
  const parts = [`${BINARY_NAME} auth login`];
  if (input.noOpen) {
    parts.push("--no-open");
  }
  if (input.profileName === DEFAULT_LOCAL_PROFILE) {
    parts.push("--local", "--web-url", input.webUrl, "--api-url", input.apiUrl);
  } else if (input.profileName !== "prod") {
    parts.push("--profile", input.profileName);
  }
  return parts.join(" ");
}

function buildConfigInitSummary(args: ParsedArgs) {
  const profileName = resolveProfileName(args.options);
  const savedConfig = loadConfigV2(profileName);
  const savedProfile = savedConfig.profiles[profileName] ?? {};
  const apiUrl = normalizeApiUrl(
    readStringOption(args.options, "api-url") ??
      process.env.MY_NOTION_API_URL ??
      savedProfile.apiUrl ??
      getDefaultApiUrlForProfile(profileName),
  );
  const webUrl = normalizeWebUrl(
    readStringOption(args.options, "web-url") ??
      process.env.MY_NOTION_WEB_URL ??
      savedProfile.webUrl ??
      getDefaultWebUrlForProfile(profileName),
  );
  const tokenConfigured = Boolean(
    readStringOption(args.options, "token") ??
      process.env.MY_NOTION_API_TOKEN ??
      savedProfile.token,
  );
  const shouldWrite = args.options.check !== true && args.options["dry-run"] !== true;
  const profile = shouldWrite
    ? saveProfileConfig({ profileName, apiUrl, webUrl })
    : savedProfile;
  const node = getNodeCheck();
  const skillsPath = getSkillsPath();
  const packageInfo = readPackageInfo();
  const authLogin = buildLoginCommand({ profileName, webUrl, apiUrl });
  const agentLogin = buildLoginCommand({ profileName, webUrl, apiUrl, noOpen: true });
  const ready = node.ok && tokenConfigured;

  return {
    ok: ready,
    ready,
    initialized: shouldWrite,
    packageName: packageInfo.name ?? PACKAGE_NAME,
    version: packageInfo.version ?? "0.0.0",
    profile: {
      name: profileName,
      local: profileName === DEFAULT_LOCAL_PROFILE,
      apiUrl,
      webUrl,
      authMethod: profile.authMethod,
      tokenConfigured,
      configPath: getConfigPath(profileName),
    },
    checks: {
      node,
      config: {
        ok: true,
        path: getConfigPath(profileName),
        written: shouldWrite,
      },
      auth: {
        ok: tokenConfigured,
        status: tokenConfigured ? "configured" : "missing",
        message: tokenConfigured
          ? "Saved or environment auth is available."
          : "Run browser login before creating, updating, or fetching private documents.",
      },
      skills: {
        ok: existsSync(skillsPath),
        bundled: existsSync(skillsPath),
        path: skillsPath,
        installCommand: SKILLS_INSTALL_COMMAND,
      },
      mcp: {
        ok: true,
        command: `${BINARY_NAME} mcp serve --transport stdio`,
      },
    },
    commands: {
      login: authLogin,
      agentLogin,
      installSkills: SKILLS_INSTALL_COMMAND,
      mcpServe: `${BINARY_NAME} mcp serve --transport stdio`,
      checkStatus: `${BINARY_NAME} auth status --format json`,
      createDoc: `${BINARY_NAME} docs create --title "Agent Doc" --content-file ./draft.md --format json`,
    },
    nextSteps: tokenConfigured
      ? [
          `Verify auth: ${BINARY_NAME} auth status --format json`,
          `Install Agent Skills: ${SKILLS_INSTALL_COMMAND}`,
          `Start MCP server: ${BINARY_NAME} mcp serve --transport stdio`,
        ]
      : [
          `Login with browser auth: ${authLogin}`,
          `Agent login flow: ${agentLogin}`,
          `Install Agent Skills: ${SKILLS_INSTALL_COMMAND}`,
        ],
  };
}

export async function runConfigCommand(args: ParsedArgs) {
  const action = args.positionals[1];

  if (action !== "init") {
    throw new Error("Unknown config command. Usage: my-notion config init [--check]");
  }

  const summary = buildConfigInitSummary(args);
  writeOutput(summary, getOutputFormat(args.options, "json"));
}
