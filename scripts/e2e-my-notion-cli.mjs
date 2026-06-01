#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const cliEntry = join(root, "packages/my-notion-cli/dist/index.js");

setDefaultAutoSelectFamilyAttemptTimeout(1_000);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMachineApi({ apiUrl, token }) {
  let lastStatus = "not-started";
  let lastCode = "UNKNOWN";

  for (let attempt = 1; attempt <= 15; attempt += 1) {
    try {
      const authResponse = await fetch(`${apiUrl}/cli/v1/auth/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const authPayload = await authResponse.json().catch(() => null);
      lastStatus = String(authResponse.status);
      lastCode = authPayload?.success === false ? authPayload.error?.code ?? "UNKNOWN" : "OK";

      const documentResponse = await fetch(`${apiUrl}/cli/v1/documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: " " }),
      });
      const documentPayload = await documentResponse.json().catch(() => null);
      lastStatus = `${authResponse.status}/${documentResponse.status}`;
      lastCode = documentPayload?.success === false ? documentPayload.error?.code ?? "UNKNOWN" : "OK";

      if (
        authResponse.ok &&
        authPayload?.success === true &&
        documentResponse.status === 422 &&
        documentPayload?.error?.code === "VALIDATION_ERROR"
      ) {
        return;
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
      lastCode = "NETWORK_ERROR";
    }

    await sleep(1_000);
  }

  throw new Error(`Machine API was not ready after Convex push. Last status: ${lastStatus}; code: ${lastCode}`);
}

async function main() {
  const testUserId = `test_cli_user_${Date.now()}`;
  const apiUrl = getSiteUrl();
  const pat = createPat();
  const tempHome = mkdtempSync(join(tmpdir(), "my-notion-cli-e2e-"));
  const contentFile = join(tempHome, "draft.md");
  const updatedFile = join(tempHome, "updated.md");
  const exportedFile = join(tempHome, "exported.md");
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
  let imported;
  let searchResults = [];
  let revokedToken = null;
  let archivedDocument = null;
  let archivedImportedDocument = null;
  const cliEnv = { HOME: tempHome };

  const identityArgs = JSON.stringify({ subject: testUserId, tokenIdentifier: testUserId });

  try {
    console.log(`[1/13] Build CLI`);
    run("pnpm", ["--filter", "@mynotion/cli", "build"]);

    console.log(`[2/13] Seed PAT token: ${pat.tokenPrefix}...`);
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

    console.log(`[3/13] Wait for Machine API readiness`);
    await waitForMachineApi({ apiUrl, token: pat.token });

    console.log(`[4/13] auth login`);
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

    console.log(`[5/13] docs create`);
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

    console.log(`[6/13] docs fetch`);
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

    console.log(`[7/13] docs update`);
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

    console.log(`[8/13] docs search`);
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

    console.log(`[9/13] docs export`);
    const exportResult = runJson("node", [
      cliEntry,
      "docs",
      "export",
      "--id",
      created.id,
      "--output",
      exportedFile,
      "--format",
      "markdown",
    ], { env: cliEnv });

    const exportedMarkdown = readFileSync(exportedFile, "utf8");
    if (!exportResult.output || !exportedMarkdown.includes(uniqueKeyword) || !exportedMarkdown.includes("Appended content")) {
      throw new Error("docs export did not write expected Markdown content");
    }

    console.log(`[10/13] docs import`);
    imported = runJson("node", [
      cliEntry,
      "docs",
      "import",
      "--title",
      `Imported CLI E2E ${uniqueKeyword}`,
      "--file",
      exportedFile,
      "--format",
      "json",
    ], { env: cliEnv });

    if (!imported.id || !imported.contentMarkdown.includes(uniqueKeyword)) {
      throw new Error("docs import did not create expected document");
    }

    console.log(`[11/13] docs archive`);
    archivedDocument = runJson("node", [
      cliEntry,
      "docs",
      "archive",
      "--id",
      created.id,
      "--format",
      "json",
    ], { env: cliEnv });

    if (!archivedDocument.isArchived) {
      throw new Error("docs archive did not mark the document as archived");
    }

    archivedImportedDocument = runJson("node", [
      cliEntry,
      "docs",
      "archive",
      "--id",
      imported.id,
      "--format",
      "json",
    ], { env: cliEnv });

    if (!archivedImportedDocument.isArchived) {
      throw new Error("docs archive did not mark the imported document as archived");
    }

    const postArchiveSearch = runJson("node", [
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

    if (Array.isArray(postArchiveSearch) && postArchiveSearch.some((doc) => doc.id === created.id)) {
      throw new Error("archived document still appeared in docs search");
    }

    console.log(`[12/13] tokens revoke-current`);
    revokedToken = runJson("node", [
      cliEntry,
      "tokens",
      "revoke-current",
      "--format",
      "json",
    ], { env: cliEnv });
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

    console.log(`[13/13] auth logout`);
    const logout = runJson("node", [
      cliEntry,
      "auth",
      "logout",
      "--format",
      "json",
    ], { env: cliEnv });

    if (!logout.loggedOut || logout.hasToken) {
      throw new Error("auth logout did not clear the saved token");
    }

    console.log(JSON.stringify({
    success: true,
    apiUrl,
    testUserId,
    tokenPrefix: pat.tokenPrefix,
    documentId: created.id,
    importedDocumentId: imported.id,
    archived: archivedDocument.isArchived,
    importedArchived: archivedImportedDocument.isArchived,
    searchHits: searchResults.length,
    revokedTokenId: revokedToken.id,
    revokedAt: revokedToken.revokedAt,
    loggedOut: logout.loggedOut,
  }, null, 2));
  } finally {
    if (created?.id && !archivedDocument?.isArchived && tokenRecordId) {
      try {
        console.log(`[cleanup] archive test document`);
        const cleanupArchive = runJson("node", [
          cliEntry,
          "docs",
          "archive",
          "--id",
          created.id,
          "--api-url",
          apiUrl,
          "--token",
          pat.token,
          "--format",
          "json",
        ], { env: cliEnv });
        archivedDocument = cleanupArchive;
      } catch (error) {
        console.error(`Failed to archive test document: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (imported?.id && !archivedImportedDocument?.isArchived && tokenRecordId) {
      try {
        console.log(`[cleanup] archive imported test document`);
        const cleanupArchive = runJson("node", [
          cliEntry,
          "docs",
          "archive",
          "--id",
          imported.id,
          "--api-url",
          apiUrl,
          "--token",
          pat.token,
          "--format",
          "json",
        ], { env: cliEnv });
        archivedImportedDocument = cleanupArchive;
      } catch (error) {
        console.error(`Failed to archive imported test document: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

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
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
