#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";

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

function parseLastJsonObject(output) {
  for (
    let index = output.lastIndexOf("{");
    index >= 0;
    index = output.lastIndexOf("{", index - 1)
  ) {
    try {
      return JSON.parse(output.slice(index).trim());
    } catch {
      // Convex 可能先打印进度日志，最后才输出 JSON 结果。
    }
  }
  throw new Error(`No JSON object found in output:\n${output}`);
}

function runJson(command, args, options = {}) {
  const output = run(command, args, options);
  return JSON.parse(output);
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

class McpStdioClient {
  constructor(env) {
    this.nextId = 1;
    this.pending = new Map();
    this.stdoutBuffer = "";
    this.stderr = "";
    // 像真实 MCP 客户端一样启动已构建 CLI：通过 stdin/stdout 传输 JSON-RPC。
    this.process = spawn("node", [cliEntry, "mcp", "serve", "--transport", "stdio"], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout.setEncoding("utf8");
    this.process.stderr.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => this.onStdout(chunk));
    this.process.stderr.on("data", (chunk) => {
      this.stderr += chunk;
    });
    this.process.on("exit", (code, signal) => {
      const error = new Error(
        `MCP server exited before response. code=${code ?? "null"} signal=${signal ?? "null"}\n${this.stderr}`,
      );
      for (const { reject } of this.pending.values()) {
        reject(error);
      }
      this.pending.clear();
    });
  }

  onStdout(chunk) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      // MCP STDIO 消息是按行分隔的 JSON-RPC 信封。
      const message = JSON.parse(line);
      if (message.id === undefined) continue;

      const pending = this.pending.get(message.id);
      if (!pending) continue;
      this.pending.delete(message.id);

      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  request(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;

    const payload = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    const response = new Promise((resolveResponse, rejectResponse) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rejectResponse(new Error(`Timed out waiting for MCP response to ${method}`));
      }, 15000);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolveResponse(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          rejectResponse(error);
        },
      });
    });

    // 显式保留换行分帧，确保测试能捕获 STDIO 协议回归。
    this.process.stdin.write(`${JSON.stringify(payload)}\n`);
    return response;
  }

  notify(method, params = {}) {
    this.process.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async close() {
    if (this.process.exitCode !== null) return;
    this.process.stdin.end();
    this.process.kill("SIGTERM");
    await Promise.race([
      once(this.process, "exit"),
      new Promise((resolveClose) => setTimeout(resolveClose, 2000)),
    ]);
  }
}

async function callTool(client, name, args) {
  const result = await callToolRaw(client, name, args);
  const text = result.content?.map((item) => item.text).filter(Boolean).join("\n");
  assert(!result.isError, `${name} returned MCP error result${text ? `:\n${text}` : ""}`);
  assert(result.structuredContent, `${name} did not return structuredContent`);
  return result.structuredContent;
}

async function callToolRaw(client, name, args) {
  const result = await client.request("tools/call", {
    name,
    arguments: args,
  });
  assert(result.structuredContent, `${name} did not return structuredContent`);
  assert(Array.isArray(result.content), `${name} did not return text fallback content`);
  return result;
}

async function main() {
  const testUserId = `test_mcp_user_${Date.now()}`;
  const apiUrl = getSiteUrl();
  const pat = createPat();
  const tempHome = mkdtempSync(join(tmpdir(), "my-notion-mcp-e2e-"));
  const uniqueKeyword = `mcp-e2e-${Date.now()}`;
  const identityArgs = JSON.stringify({ subject: testUserId, tokenIdentifier: testUserId });
  let tokenRecordId;
  let client;
  let createdDocumentId;
  let archivedDocument = null;

  try {
    console.log("[1/9] Build CLI");
    run("pnpm", ["--filter", "@notion/my-notion-cli", "build"]);

    console.log(`[2/9] Seed PAT token: ${pat.tokenPrefix}...`);
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
        name: "My-Notion MCP E2E Token",
        tokenHash: pat.tokenHash,
        tokenPrefix: pat.tokenPrefix,
        scopes: ["docs:read", "docs:write"],
      }),
    ]);
    const seededToken = parseLastJsonObject(seedOutput);
    tokenRecordId = seededToken.id;

    console.log("[3/9] Start MCP STDIO server");
    client = new McpStdioClient({
      HOME: tempHome,
      MY_NOTION_API_URL: apiUrl,
      MY_NOTION_API_TOKEN: pat.token,
    });

    console.log("[4/9] Initialize and list tools");
    const initialized = await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "my-notion-mcp-e2e",
        version: "0.1.0",
      },
    });
    client.notify("notifications/initialized");
    assert(initialized.serverInfo?.name === "my-notion", "MCP initialize returned unexpected server name");

    const tools = await client.request("tools/list");
    const toolNames = new Set((tools.tools ?? []).map((tool) => tool.name));
    for (const name of [
      "my_notion_docs_search",
      "my_notion_docs_fetch",
      "my_notion_docs_create",
      "my_notion_docs_update",
    ]) {
      assert(toolNames.has(name), `Missing MCP tool: ${name}`);
    }

    console.log("[5/9] Validate dry-run write tools");
    const createPreview = await callTool(client, "my_notion_docs_create", {
      title: `MCP Dry Run ${uniqueKeyword}`,
      contentMarkdown: `# MCP Dry Run\n\n${uniqueKeyword}`,
      dryRun: true,
    });
    assert(createPreview.dryRun === true, "create dryRun did not return dryRun=true");
    assert(createPreview.confirmationRequired === true, "create dryRun did not require confirmation");
    assert(
      typeof createPreview.message === "string" && createPreview.message.includes("No My-Notion document was created"),
      "create dryRun did not include a clear no-write message",
    );
    assert(createPreview.document?.id === "dry-run", "create dryRun did not return preview document");

    const createPreviewRaw = await callToolRaw(client, "my_notion_docs_create", {
      title: `MCP Dry Run Raw ${uniqueKeyword}`,
      contentMarkdown: `# MCP Dry Run Raw\n\n${uniqueKeyword}`,
      dryRun: true,
    });
    const createPreviewText = createPreviewRaw.content.map((item) => item.text).join("\n");
    assert(
      createPreviewText.includes("Dry run only") && createPreviewText.includes("No My-Notion document was created"),
      "create dryRun text fallback did not explain that no document was created",
    );

    const updatePreview = await callTool(client, "my_notion_docs_update", {
      id: "dry-run",
      contentMarkdown: `Append ${uniqueKeyword}`,
      mode: "append",
      dryRun: true,
    });
    assert(updatePreview.dryRun === true, "update dryRun did not return dryRun=true");
    assert(updatePreview.confirmationRequired === true, "update dryRun did not require confirmation");
    assert(
      typeof updatePreview.message === "string" && updatePreview.message.includes("No My-Notion document was updated"),
      "update dryRun did not include a clear no-write message",
    );

    const updateError = await callToolRaw(client, "my_notion_docs_update", {
      id: "missing-document-id",
      contentMarkdown: `Should fail ${uniqueKeyword}`,
      mode: "append",
      dryRun: false,
    });
    assert(updateError.isError === true, "update error did not return isError=true");
    assert(updateError.structuredContent?.error?.message, "update error did not include structured error message");
    assert(
      updateError.content.map((item) => item.text).join("\n").includes("My-Notion MCP tool failed during update"),
      "update error text fallback did not include readable failure context",
    );

    console.log("[6/9] Create, fetch, and update through MCP");
    const created = await callTool(client, "my_notion_docs_create", {
      title: `MCP E2E ${uniqueKeyword}`,
      contentMarkdown: `# MCP E2E\n\nInitial ${uniqueKeyword}.`,
      dryRun: false,
    });
    createdDocumentId = created.document?.id;
    assert(createdDocumentId, "MCP create did not return document id");

    const fetched = await callTool(client, "my_notion_docs_fetch", {
      id: createdDocumentId,
    });
    assert(
      typeof fetched.markdown === "string" && fetched.markdown.includes(uniqueKeyword),
      "MCP fetch did not return created Markdown content",
    );

    const updated = await callTool(client, "my_notion_docs_update", {
      id: createdDocumentId,
      contentMarkdown: `Appended by MCP ${uniqueKeyword}.`,
      mode: "append",
      dryRun: false,
    });
    assert(
      updated.markdown.includes("Appended by MCP"),
      "MCP update did not append Markdown content",
    );

    console.log("[7/9] Search through MCP");
    const search = await callTool(client, "my_notion_docs_search", {
      query: uniqueKeyword,
      limit: 5,
    });
    const documents = search.documents ?? [];
    assert(
      Array.isArray(documents) && documents.some((document) => document.id === createdDocumentId),
      "MCP search did not find the created document",
    );

    console.log("[8/9] Close MCP server");
    await client.close();

    console.log("[9/9] Archive test document");
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
          apiUrl,
          testUserId,
          tokenPrefix: pat.tokenPrefix,
          documentId: createdDocumentId,
          archived: archivedDocument.isArchived,
          searchHits: documents.length,
        },
        null,
        2,
      ),
    );
  } finally {
    if (client) {
      await client.close();
    }

    if (createdDocumentId && !archivedDocument?.isArchived && tokenRecordId) {
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
        // 即使测试失败也撤销 PAT，避免 dev 环境积累可用测试凭据。
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
