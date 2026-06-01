#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "../packages/my-notion-cli/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../packages/my-notion-cli/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";

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
  return JSON.parse(run(command, args, options));
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
      // Convex may print progress logs before the final JSON result.
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

  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ??
    webEnv.NEXT_PUBLIC_CONVEX_URL ??
    rootEnv.NEXT_PUBLIC_CONVEX_URL;
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createSdkClient(env) {
  const transport = new StdioClientTransport({
    command: "node",
    args: [cliEntry, "mcp", "serve", "--transport", "stdio"],
    cwd: root,
    env,
    stderr: "pipe",
  });
  const client = new Client({
    name: "my-notion-real-mcp-client-e2e",
    version: "0.1.0",
  });
  await client.connect(transport);
  return client;
}

async function callTool(client, name, args) {
  const result = await client.callTool({
    name,
    arguments: args,
  });
  assert(result.structuredContent, `${name} did not return structuredContent`);
  assert(Array.isArray(result.content), `${name} did not return text fallback content`);
  assert(!result.isError, `${name} returned MCP error: ${JSON.stringify(result.structuredContent)}`);
  return result.structuredContent;
}

async function callToolRaw(client, name, args) {
  const result = await client.callTool({
    name,
    arguments: args,
  });
  assert(result.structuredContent, `${name} did not return structuredContent`);
  assert(Array.isArray(result.content), `${name} did not return text fallback content`);
  return result;
}

async function main() {
  const testUserId = `test_mcp_sdk_user_${Date.now()}`;
  const apiUrl = getSiteUrl();
  const pat = createPat();
  const tempHome = mkdtempSync(join(tmpdir(), "my-notion-mcp-sdk-e2e-"));
  const uniqueKeyword = `mcp-sdk-e2e-${Date.now()}`;
  const identityArgs = JSON.stringify({ subject: testUserId, tokenIdentifier: testUserId });
  let tokenRecordId;
  let validClient;
  let invalidClient;
  let createdDocumentId;
  let archivedDocument = null;

  try {
    console.log("[1/11] Build CLI");
    run("pnpm", ["--filter", "@mynotion/cli", "build"]);

    console.log(`[2/11] Seed PAT token: ${pat.tokenPrefix}...`);
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
        name: "My-Notion MCP SDK Client E2E Token",
        tokenHash: pat.tokenHash,
        tokenPrefix: pat.tokenPrefix,
        scopes: ["docs:read", "docs:write"],
      }),
    ]);
    const seededToken = parseLastJsonObject(seedOutput);
    tokenRecordId = seededToken.id;

    console.log("[3/11] Wait for Machine API readiness");
    await waitForMachineApi({ apiUrl, token: pat.token });

    console.log("[4/11] Validate auth failure through real MCP Client");
    invalidClient = await createSdkClient({
      HOME: tempHome,
      MY_NOTION_API_URL: apiUrl,
      MY_NOTION_API_TOKEN: "mnt_invalid",
    });
    const invalidSearch = await callToolRaw(invalidClient, "my_notion_docs_search", {
      query: uniqueKeyword,
      limit: 1,
    });
    assert(invalidSearch.isError === true, "invalid auth did not return isError=true");
    assert(
      invalidSearch.structuredContent?.error?.message,
      "invalid auth did not return structured error message",
    );
    await invalidClient.close();
    invalidClient = undefined;

    console.log("[5/11] Connect real MCP SDK Client");
    validClient = await createSdkClient({
      HOME: tempHome,
      MY_NOTION_API_URL: apiUrl,
      MY_NOTION_API_TOKEN: pat.token,
    });
    assert(validClient.getServerVersion()?.name === "my-notion", "Unexpected MCP server name");

    console.log("[6/11] Discover tools");
    const tools = await validClient.listTools();
    const toolNames = new Set((tools.tools ?? []).map((tool) => tool.name));
    for (const name of [
      "my_notion_docs_search",
      "my_notion_docs_fetch",
      "my_notion_docs_create",
      "my_notion_docs_update",
    ]) {
      assert(toolNames.has(name), `Missing MCP tool: ${name}`);
    }

    console.log("[7/11] Validate dry-run create and update");
    const createPreview = await callTool(validClient, "my_notion_docs_create", {
      title: `MCP SDK Dry Run ${uniqueKeyword}`,
      contentMarkdown: `# MCP SDK Dry Run\n\n${uniqueKeyword}`,
      dryRun: true,
    });
    assert(createPreview.dryRun === true, "create dryRun did not return dryRun=true");
    assert(createPreview.confirmationRequired === true, "create dryRun did not require confirmation");
    assert(createPreview.document?.id === "dry-run", "create dryRun did not return preview document");
    assert(
      createPreview.message?.includes("No My-Notion document was created"),
      "create dryRun did not include no-write message",
    );

    const updatePreview = await callTool(validClient, "my_notion_docs_update", {
      id: "dry-run",
      contentMarkdown: `Append ${uniqueKeyword}`,
      mode: "append",
      dryRun: true,
    });
    assert(updatePreview.dryRun === true, "update dryRun did not return dryRun=true");
    assert(updatePreview.confirmationRequired === true, "update dryRun did not require confirmation");
    assert(
      updatePreview.message?.includes("No My-Notion document was updated"),
      "update dryRun did not include no-write message",
    );

    console.log("[8/11] Confirm and create real document");
    const created = await callTool(validClient, "my_notion_docs_create", {
      title: `MCP SDK E2E ${uniqueKeyword}`,
      contentMarkdown: `# MCP SDK E2E\n\nInitial ${uniqueKeyword}.`,
      dryRun: false,
    });
    createdDocumentId = created.document?.id;
    assert(createdDocumentId, "MCP create did not return document id");

    console.log("[9/11] Fetch and update real document");
    const fetched = await callTool(validClient, "my_notion_docs_fetch", {
      id: createdDocumentId,
    });
    assert(fetched.markdown?.includes(uniqueKeyword), "MCP fetch did not return created content");

    const updated = await callTool(validClient, "my_notion_docs_update", {
      id: createdDocumentId,
      contentMarkdown: `Appended by real MCP SDK Client ${uniqueKeyword}.`,
      mode: "append",
      dryRun: false,
    });
    assert(
      updated.markdown?.includes("Appended by real MCP SDK Client"),
      "MCP update did not append content",
    );

    console.log("[10/11] Search real document");
    const search = await callTool(validClient, "my_notion_docs_search", {
      query: uniqueKeyword,
      limit: 5,
    });
    const documents = search.documents ?? [];
    assert(
      Array.isArray(documents) && documents.some((document) => document.id === createdDocumentId),
      "MCP search did not find the created document",
    );

    console.log("[11/11] Archive test document");
    await validClient.close();
    validClient = undefined;
    archivedDocument = runJson("node", [
      cliEntry,
      "docs",
      "archive",
      "--id",
      createdDocumentId,
      "--api-url",
      apiUrl,
      "--token",
      pat.token,
      "--format",
      "json",
    ], { env: { HOME: tempHome } });
    assert(archivedDocument.isArchived === true, "CLI archive did not mark MCP test document as archived");

    console.log(
      JSON.stringify(
        {
          success: true,
          client: "@modelcontextprotocol/sdk Client + StdioClientTransport",
          apiUrl,
          testUserId,
          tokenPrefix: pat.tokenPrefix,
          documentId: createdDocumentId,
          archived: archivedDocument.isArchived,
          discoveredTools: [...toolNames].sort(),
          searchHits: documents.length,
        },
        null,
        2,
      ),
    );
  } finally {
    if (invalidClient) await invalidClient.close();
    if (validClient) await validClient.close();

    if (createdDocumentId && !archivedDocument?.isArchived) {
      try {
        console.log("[cleanup] archive test document");
        archivedDocument = runJson("node", [
          cliEntry,
          "docs",
          "archive",
          "--id",
          createdDocumentId,
          "--api-url",
          apiUrl,
          "--token",
          pat.token,
          "--format",
          "json",
        ], { env: { HOME: tempHome } });
      } catch (error) {
        console.error(
          `Failed to archive test document: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (tokenRecordId) {
      try {
        console.log("[cleanup] revoke PAT token");
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
        console.error(
          `Failed to revoke test token: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    rmSync(tempHome, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
