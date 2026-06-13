import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getOutputFormat, writeOutput } from "../format/output.js";
import type { ParsedArgs } from "../types.js";

const PACKAGE_NAME = "@mynotion/cli";
const BINARY_NAME = "my-notion";
const DEFAULT_TAG = "latest";
const SKILLS_INSTALL_COMMAND = "npx skills add @mynotion/cli -y -g";

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

function buildInstallSummary() {
  const packageInfo = readPackageInfo();
  const skillsPath = getSkillsPath();
  return {
    packageName: packageInfo.name ?? PACKAGE_NAME,
    version: packageInfo.version ?? "0.0.0",
    binary: BINARY_NAME,
    skillsPath,
    skillsBundled: existsSync(skillsPath),
    commands: {
      installCli: `npm install -g ${PACKAGE_NAME}@${DEFAULT_TAG}`,
      installSkills: SKILLS_INSTALL_COMMAND,
      runWithNpx: `npx ${PACKAGE_NAME}@${DEFAULT_TAG} --help`,
      updateCli: `npm install -g ${PACKAGE_NAME}@${DEFAULT_TAG}`,
      checkUpdate: `${BINARY_NAME} update --check --format json`,
      login: `${BINARY_NAME} auth login`,
      agentLogin: `${BINARY_NAME} auth login --no-open`,
    },
    nextSteps: [
      `Install the CLI: npm install -g ${PACKAGE_NAME}@${DEFAULT_TAG}`,
      `Install Agent Skills: ${SKILLS_INSTALL_COMMAND}`,
      `Check updates: ${BINARY_NAME} update --check --format json`,
      `Login with browser auth: ${BINARY_NAME} auth login`,
    ],
  };
}

function printHumanSummary(summary: ReturnType<typeof buildInstallSummary>) {
  console.log(`My-Notion CLI install guide

Package: ${summary.packageName}@${summary.version}
Binary:  ${summary.binary}
Skills:  ${summary.skillsBundled ? "bundled" : "not bundled in this build"}

Recommended:
  ${summary.commands.installCli}
  ${summary.commands.installSkills}
  ${summary.commands.login}

Agent mode:
  ${summary.commands.agentLogin}
`);
}

export async function runInstallCommand(args: ParsedArgs) {
  const summary = buildInstallSummary();
  const format = getOutputFormat(args.options, "pretty");

  if (args.options.check === true) {
    writeOutput(
      {
        ok: summary.skillsBundled,
        ...summary,
      },
      format,
    );
    return;
  }

  if (args.options.skills === true) {
    writeOutput(
      {
        ...summary,
        message:
          "Run the installSkills command to install My-Notion Agent Skills globally.",
      },
      format,
    );
    return;
  }

  if (format === "json" || format === "pretty" || format === "table" || format === "ndjson") {
    writeOutput(summary, format);
    return;
  }

  printHumanSummary(summary);
}
