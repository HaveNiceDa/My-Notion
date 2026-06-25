import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getOutputFormat, writeOutput } from "../format/output.js";
import type { ParsedArgs } from "../types.js";

const PACKAGE_NAME = "@mynotion/cli";
const BINARY_NAME = "my-notion";
const MCP_PACKAGE_NAME = "@mynotion/mcp-server";
const MCP_BINARY_NAME = "my-notion-mcp-server";
const DEFAULT_TAG = "latest";
const SKILLS_INSTALL_COMMAND = "npx skills add @mynotion/cli -y -g";
const NPM_REGISTRY_URL = "https://registry.npmjs.org";
const UPDATE_CHECK_TIMEOUT_MS = 5_000;

type PackageInfo = {
  name?: string;
  version?: string;
};

type NpmDistTagResponse = {
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

function encodePackageName(packageName: string) {
  return encodeURIComponent(packageName).replace("%40", "@");
}

async function fetchNpmDistTagVersion(input: {
  packageName: string;
  tag: string;
  registryUrl: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
  const url = `${input.registryUrl.replace(/\/+$/, "")}/${encodePackageName(
    input.packageName,
  )}/${input.tag}`;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`npm registry returned HTTP ${response.status}`);
    }
    const data = (await response.json()) as NpmDistTagResponse;
    return data.version;
  } finally {
    clearTimeout(timeout);
  }
}

function buildUpdateSummary(input: {
  latestVersion?: string;
  checkError?: string;
  tag: string;
}) {
  const packageInfo = readPackageInfo();
  const packageName = packageInfo.name ?? PACKAGE_NAME;
  const currentVersion = packageInfo.version ?? "0.0.0";
  const latestVersion = input.latestVersion;
  const updateAvailable =
    latestVersion === undefined ? null : latestVersion !== currentVersion;

  return {
    ok: input.checkError ? false : true,
    packageName,
    binary: BINARY_NAME,
    currentVersion,
    targetTag: input.tag,
    latestVersion,
    updateAvailable,
    checkError: input.checkError,
    autoUpdated: false,
    requiresUserConfirmation: true,
    commands: {
      updateCli: `npm install -g ${packageName}@${input.tag}`,
      updateMcpServer: `npm install -g ${MCP_PACKAGE_NAME}@${input.tag}`,
      runLatestWithNpx: `npx ${packageName}@${input.tag} --help`,
      updateSkills: SKILLS_INSTALL_COMMAND,
      verifyMcpServer: `${MCP_BINARY_NAME} --help`,
      verifyCli: `${BINARY_NAME} update --check --format json`,
      verifyConfig: `${BINARY_NAME} config init --check --format json`,
    },
    nextSteps: [
      `Ask the user before updating the global CLI.`,
      `Update CLI: npm install -g ${packageName}@${input.tag}`,
      `Update MCP server: npm install -g ${MCP_PACKAGE_NAME}@${input.tag}`,
      `Update Agent Skills: ${SKILLS_INSTALL_COMMAND}`,
      `Verify: ${BINARY_NAME} update --check --format json`,
    ],
  };
}

function printHumanSummary(summary: ReturnType<typeof buildUpdateSummary>) {
  const latest = summary.latestVersion ?? "unknown";
  const available =
    summary.updateAvailable === null
      ? "unknown"
      : summary.updateAvailable
        ? "yes"
        : "no";

  console.log(`My-Notion CLI update guide

Package:          ${summary.packageName}
Current version:  ${summary.currentVersion}
Target tag:       ${summary.targetTag}
Latest version:   ${latest}
Update available: ${available}

Recommended:
  ${summary.commands.updateCli}
  ${summary.commands.updateMcpServer}
  ${summary.commands.updateSkills}
  ${summary.commands.verifyCli}
`);
}

export async function runUpdateCommand(args: ParsedArgs) {
  const tag = typeof args.options.tag === "string" ? args.options.tag : DEFAULT_TAG;
  const registryUrl =
    typeof args.options.registry === "string" ? args.options.registry : NPM_REGISTRY_URL;
  let latestVersion: string | undefined;
  let checkError: string | undefined;

  if (args.options.check === true) {
    try {
      latestVersion = await fetchNpmDistTagVersion({
        packageName: PACKAGE_NAME,
        tag,
        registryUrl,
      });
    } catch (error) {
      checkError = error instanceof Error ? error.message : String(error);
    }
  }

  const summary = buildUpdateSummary({ latestVersion, checkError, tag });
  const format = getOutputFormat(args.options, "pretty");

  if (format === "json" || format === "pretty" || format === "table" || format === "ndjson") {
    writeOutput(summary, format);
    return;
  }

  printHumanSummary(summary);
}
