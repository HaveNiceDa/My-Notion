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
import { basename, join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const sourceRoot = join(root, "packages/my-notion-skills");
const targetRoot = join(root, ".trae/skills");

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

function syncSkill(sourceDir) {
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
    description: frontmatter.description,
    targetDir,
  };
}

function main() {
  if (!existsSync(sourceRoot)) {
    throw new Error(`Source skills directory not found: ${sourceRoot}`);
  }

  mkdirSync(targetRoot, { recursive: true });
  const synced = findSkillDirs().map(syncSkill);

  if (synced.length === 0) {
    throw new Error(`No skills found under ${sourceRoot}`);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        sourceRoot,
        targetRoot,
        synced: synced.map((skill) => ({
          name: skill.name,
          targetDir: skill.targetDir,
        })),
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
