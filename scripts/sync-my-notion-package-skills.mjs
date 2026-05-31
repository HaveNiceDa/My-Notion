#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const sourceRoot = join(root, "packages/my-notion-skills");
const targetRoot = join(root, "packages/my-notion-cli/skills");
const checkOnly = process.argv.includes("--check");

function readSkillFrontmatter(skillPath) {
  const content = readFileSync(skillPath, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error(`Missing frontmatter: ${skillPath}`);
  }

  const nameMatch = match[1].match(/^name:\s*["']?([^"'\n]+)["']?/m);
  const descriptionMatch = match[1].match(/^description:\s*["']?([^"'\n]+)["']?/m);
  if (!nameMatch || !descriptionMatch) {
    throw new Error(`Missing name or description in frontmatter: ${skillPath}`);
  }

  return {
    name: nameMatch[1],
    description: descriptionMatch[1],
  };
}

function findSkillDirs() {
  return readdirSync(sourceRoot)
    .map((entry) => join(sourceRoot, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .filter((entryPath) => existsSync(join(entryPath, "SKILL.md")));
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];

  const result = [];
  for (const entry of readdirSync(dir)) {
    if (entry === ".gitkeep") continue;

    const entryPath = join(dir, entry);
    const stat = statSync(entryPath);
    if (stat.isDirectory()) {
      result.push(...listFiles(entryPath));
    } else if (stat.isFile()) {
      result.push(entryPath);
    }
  }

  return result;
}

function copySkill(sourceDir) {
  const sourceSkillPath = join(sourceDir, "SKILL.md");
  const sourceDirName = basename(sourceDir);
  const frontmatter = readSkillFrontmatter(sourceSkillPath);
  if (frontmatter.name !== sourceDirName) {
    throw new Error(
      `Skill name mismatch: folder is ${sourceDirName}, frontmatter name is ${frontmatter.name}`,
    );
  }

  const targetDir = join(targetRoot, sourceDirName);
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(sourceDir, targetDir, {
    recursive: true,
    filter: (source) => !source.endsWith(".gitkeep"),
  });

  return {
    name: frontmatter.name,
    targetDir,
  };
}

function checkSkill(sourceDir) {
  const sourceSkillPath = join(sourceDir, "SKILL.md");
  const sourceDirName = basename(sourceDir);
  const frontmatter = readSkillFrontmatter(sourceSkillPath);
  const targetDir = join(targetRoot, sourceDirName);
  const sourceFiles = listFiles(sourceDir);
  const targetFiles = listFiles(targetDir);
  const expected = new Map(
    sourceFiles.map((filePath) => [relative(sourceDir, filePath), filePath]),
  );
  const actual = new Map(
    targetFiles.map((filePath) => [relative(targetDir, filePath), filePath]),
  );
  const diffs = [];

  for (const [relativePath, sourcePath] of expected) {
    const targetPath = actual.get(relativePath);
    if (!targetPath) {
      diffs.push({ type: "missing", skill: sourceDirName, path: relativePath });
      continue;
    }

    if (readFileSync(sourcePath, "utf8") !== readFileSync(targetPath, "utf8")) {
      diffs.push({ type: "modified", skill: sourceDirName, path: relativePath });
    }
  }

  for (const relativePath of actual.keys()) {
    if (!expected.has(relativePath)) {
      diffs.push({ type: "extra", skill: sourceDirName, path: relativePath });
    }
  }

  return {
    name: frontmatter.name,
    targetDir,
    diffs,
  };
}

function main() {
  if (!existsSync(sourceRoot)) {
    throw new Error(`Source skills directory not found: ${sourceRoot}`);
  }

  mkdirSync(targetRoot, { recursive: true });
  const skillDirs = findSkillDirs();

  if (checkOnly) {
    const checked = skillDirs.map(checkSkill);
    const diffs = checked.flatMap((skill) => skill.diffs);
    const success = diffs.length === 0;
    console.log(
      JSON.stringify(
        {
          success,
          mode: "check-package-skills",
          sourceRoot,
          targetRoot,
          checked: checked.map((skill) => ({
            name: skill.name,
            targetDir: skill.targetDir,
            diffCount: skill.diffs.length,
          })),
          diffs,
        },
        null,
        2,
      ),
    );
    if (!success) {
      process.exitCode = 1;
    }
    return;
  }

  rmSync(targetRoot, { recursive: true, force: true });
  mkdirSync(targetRoot, { recursive: true });
  const synced = skillDirs.map(copySkill);
  console.log(
    JSON.stringify(
      {
        success: true,
        mode: "sync-package-skills",
        sourceRoot,
        targetRoot,
        synced,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
