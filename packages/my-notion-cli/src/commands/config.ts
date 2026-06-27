import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_LOCAL_PROFILE,
  getConfigPath,
  loadConfigV2,
  resolveProfile,
  resolveProfileName,
  saveProfileConfig,
} from "../config/store.js";
import { getOutputFormat, writeOutput } from "../format/output.js";
import type { ParsedArgs } from "../types.js";

const PACKAGE_NAME = "@mynotion/cli";
const BINARY_NAME = "my-notion";
const MCP_PACKAGE_NAME = "@mynotion/mcp";
const MCP_BINARY_NAME = "my-notion-mcp";
const SKILLS_INSTALL_COMMAND = "npx skills add @mynotion/cli -y -g";
const MCP_INSTALL_COMMAND = `npm install -g ${MCP_PACKAGE_NAME}@latest`;
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

function buildStatusCommand(profileName: string) {
  const parts = [`${BINARY_NAME} auth status`];
  appendProfileArgs(parts, profileName);
  parts.push("--format", "json");
  return parts.join(" ");
}

function appendProfileArgs(parts: string[], profileName: string) {
  if (profileName === DEFAULT_LOCAL_PROFILE) {
    parts.push("--local");
  } else if (profileName !== "prod") {
    parts.push("--profile", profileName);
  }
}

function buildCreateDocCommand(profileName: string) {
  const parts = [
    BINARY_NAME,
    "docs",
    "create",
    "--title",
    '"Agent Doc"',
    "--content-file",
    "./draft.md",
  ];
  appendProfileArgs(parts, profileName);
  parts.push("--format", "json");
  return parts.join(" ");
}

function buildMcpServeCommand(profileName: string) {
  const parts = [MCP_BINARY_NAME, "--transport", "stdio"];
  appendProfileArgs(parts, profileName);
  return parts.join(" ");
}

function buildLegacyMcpServeCommand(profileName: string) {
  const parts = [BINARY_NAME, "mcp", "serve", "--transport", "stdio"];
  appendProfileArgs(parts, profileName);
  return parts.join(" ");
}

function buildConfigInitSummary(args: ParsedArgs) {
  const profileName = resolveProfileName(args.options);
  const resolvedProfile = resolveProfile(args.options);
  const savedConfig = loadConfigV2(profileName);
  const savedProfile = savedConfig.profiles[profileName] ?? {};
  const apiUrl = resolvedProfile.apiUrl;
  const webUrl = resolvedProfile.webUrl;
  const tokenConfigured = Boolean(resolvedProfile.token);
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
      environment: resolvedProfile.environment,
      local: resolvedProfile.local,
      apiUrl,
      webUrl,
      authMethod: profile.authMethod,
      tokenConfigured,
      tokenSource: resolvedProfile.sources.token,
      sources: resolvedProfile.sources,
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
        packageName: MCP_PACKAGE_NAME,
        command: buildMcpServeCommand(profileName),
        legacyCommand: buildLegacyMcpServeCommand(profileName),
        installCommand: MCP_INSTALL_COMMAND,
      },
    },
    commands: {
      login: authLogin,
      agentLogin,
      installSkills: SKILLS_INSTALL_COMMAND,
      installMcpServer: MCP_INSTALL_COMMAND,
      mcpServe: buildMcpServeCommand(profileName),
      legacyMcpServe: buildLegacyMcpServeCommand(profileName),
      checkStatus: buildStatusCommand(profileName),
      createDoc: buildCreateDocCommand(profileName),
    },
    nextSteps: tokenConfigured
      ? [
          `Verify auth: ${buildStatusCommand(profileName)}`,
          `Install Agent Skills: ${SKILLS_INSTALL_COMMAND}`,
          `Install MCP server: ${MCP_INSTALL_COMMAND}`,
          `Start MCP server: ${buildMcpServeCommand(profileName)}`,
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
