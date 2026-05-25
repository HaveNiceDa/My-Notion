#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const cliEntry = join(root, "packages/my-notion-cli/dist/index.js");

function readEnvFile(path) {
  try {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    const result = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      result[match[1]] = match[2].replace(/\s+#.*$/, "");
    }
    return result;
  } catch {
    return {};
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result.stdout.trim();
}

function runJson(command, args, options = {}) {
  const output = run(command, args, options);
  return JSON.parse(output);
}

function parseLastJsonObject(output) {
  for (
    let index = output.lastIndexOf("{");
    index >= 0;
    index = output.lastIndexOf("{", index - 1)
  ) {
    try {
      return JSON.parse(output.slice(index).trim());
    } catch {
      // Convex can print progress lines before the final JSON payload.
    }
  }
  throw new Error(`No JSON object found in output:\n${output}`);
}

function createPat() {
  const token = `mnt_${randomBytes(32).toString("base64url")}`;
  return {
    token,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    tokenPrefix: token.slice(0, 12),
  };
}

function getSiteUrl() {
  const rootEnv = readEnvFile(join(root, ".env.local"));
  const webEnv = readEnvFile(join(root, "apps/web/.env.local"));
  const explicit = process.env.MY_NOTION_E2E_API_URL ?? webEnv.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? webEnv.NEXT_PUBLIC_CONVEX_URL ?? rootEnv.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL or MY_NOTION_E2E_API_URL");
  }

  return convexUrl.replace(".convex.cloud", ".convex.site").replace(/\/+$/, "");
}

function main() {
  const testUserId = `test_cli_user_${Date.now()}`;
  const apiUrl = getSiteUrl();
  const pat = createPat();
  const tempHome = mkdtempSync(join(tmpdir(), "my-notion-cli-e2e-"));
  const contentFile = join(tempHome, "draft.md");
  const updatedFile = join(tempHome, "updated.md");
  const uniqueKeyword = `e2e-${Date.now()}`;

  writeFileSync(
    contentFile,
    [`# CLI E2E`, "", `Initial content for ${uniqueKeyword}.`].join("\n"),
    "utf8",
  );
  writeFileSync(
    updatedFile,
    [`Appended content for ${uniqueKeyword}.`].join("\n"),
    "utf8",
  );

  let tokenRecordId;
  let created;
  let searchResults = [];
  let revokedToken = null;

  const identityArgs = JSON.stringify({ subject: testUserId, tokenIdentifier: testUserId });

  try {
    console.log(`[1/8] Build CLI`);
    run("pnpm", ["--filter", "@notion/my-notion-cli", "build"]);

    console.log(`[2/8] Seed PAT token: ${pat.tokenPrefix}...`);
    const seedOutput = run("pnpm", [
    "--filter",
    "@notion/web",
    "exec",
    "convex",
    "run",
    "--push",
    "--deployment",
    "dev",
    "--identity",
    identityArgs,
    "cli:createApiTokenRecord",
    JSON.stringify({
      name: "My-Notion CLI E2E Token",
      tokenHash: pat.tokenHash,
      tokenPrefix: pat.tokenPrefix,
      scopes: ["docs:read", "docs:write"],
    }),
    ]);
    const seededToken = parseLastJsonObject(seedOutput);
    tokenRecordId = seededToken.id;

    const cliEnv = { HOME: tempHome };

    console.log(`[3/8] auth login`);
    const login = runJson("node", [
    cliEntry,
    "auth",
    "login",
    "--api-url",
    apiUrl,
    "--token",
    pat.token,
    "--format",
    "json",
    ], { env: cliEnv });

    if (!login.authenticated) {
      throw new Error("auth login did not authenticate");
    }

    console.log(`[4/8] docs create`);
    created = runJson("node", [
    cliEntry,
    "docs",
    "create",
    "--title",
    `CLI E2E ${uniqueKeyword}`,
    "--content-file",
    contentFile,
    "--format",
    "json",
    ], { env: cliEnv });

    if (!created.id) {
      throw new Error("docs create did not return document id");
    }

    console.log(`[5/8] docs fetch`);
    const fetchedMarkdown = run("node", [
    cliEntry,
    "docs",
    "fetch",
    "--id",
    created.id,
    "--format",
    "markdown",
    ], { env: cliEnv });

    if (!fetchedMarkdown.includes(uniqueKeyword)) {
      throw new Error("docs fetch did not include created content");
    }

    console.log(`[6/8] docs update`);
    const updated = runJson("node", [
    cliEntry,
    "docs",
    "update",
    "--id",
    created.id,
    "--content-file",
    updatedFile,
    "--mode",
    "append",
    "--format",
    "json",
    ], { env: cliEnv });

    if (!updated.contentMarkdown.includes("Appended content")) {
      throw new Error("docs update did not append content");
    }

    console.log(`[7/8] docs search`);
    searchResults = runJson("node", [
    cliEntry,
    "docs",
    "search",
    "--query",
    uniqueKeyword,
    "--limit",
    "5",
    "--format",
    "json",
    ], { env: cliEnv });

    if (!Array.isArray(searchResults) || !searchResults.some((doc) => doc.id === created.id)) {
      throw new Error("docs search did not find the created document");
    }

    console.log(`[8/8] revoke PAT token`);
    const revokeOutput = run("pnpm", [
      "--filter",
      "@notion/web",
      "exec",
      "convex",
      "run",
      "--deployment",
      "dev",
      "--identity",
      identityArgs,
      "cli:revokeApiTokenRecord",
      JSON.stringify({ tokenId: tokenRecordId }),
    ]);
    revokedToken = parseLastJsonObject(revokeOutput);
    tokenRecordId = undefined;

    const revokedStatus = spawnSync("node", [
      cliEntry,
      "auth",
      "status",
      "--api-url",
      apiUrl,
      "--token",
      pat.token,
      "--format",
      "json",
    ], {
      cwd: root,
      env: { ...process.env, ...cliEnv },
      encoding: "utf8",
    });

    if (revokedStatus.status === 0) {
      throw new Error("revoked token still passed auth status");
    }

    console.log(JSON.stringify({
    success: true,
    apiUrl,
    testUserId,
    tokenPrefix: pat.tokenPrefix,
    documentId: created.id,
    searchHits: searchResults.length,
    revokedTokenId: revokedToken.id,
    revokedAt: revokedToken.revokedAt,
  }, null, 2));
  } finally {
    if (tokenRecordId) {
      try {
        console.log(`[cleanup] revoke PAT token`);
        run("pnpm", [
          "--filter",
          "@notion/web",
          "exec",
          "convex",
          "run",
          "--deployment",
          "dev",
          "--identity",
          identityArgs,
          "cli:revokeApiTokenRecord",
          JSON.stringify({ tokenId: tokenRecordId }),
        ]);
      } catch (error) {
        console.error(`Failed to revoke test token: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    rmSync(tempHome, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
