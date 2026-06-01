#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

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

function parseLastJsonObject(output) {
  for (
    let index = output.lastIndexOf("{");
    index >= 0;
    index = output.lastIndexOf("{", index - 1)
  ) {
    try {
      return JSON.parse(output.slice(index).trim());
    } catch {
      // Convex can print deployment progress before the final JSON payload.
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function seedToken({ name, userId, scopes, expiresAt }) {
  const pat = createPat();
  const identityArgs = JSON.stringify({ subject: userId, tokenIdentifier: userId });
  const output = run("pnpm", [
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
      name,
      tokenHash: pat.tokenHash,
      tokenPrefix: pat.tokenPrefix,
      scopes,
      expiresAt,
    }),
  ]);
  const seeded = parseLastJsonObject(output);
  return {
    ...pat,
    id: seeded.id,
    userId,
    identityArgs,
  };
}

function revokeToken(record) {
  run("pnpm", [
    "--filter",
    "@notion/web",
    "exec",
    "convex",
    "run",
    "--deployment",
    "dev",
    "--identity",
    record.identityArgs,
    "cli:revokeApiTokenRecord",
    JSON.stringify({ tokenId: record.id }),
  ]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest(apiUrl, { method = "GET", path, token, body }) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      return { response, payload };
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
      await sleep(300 * 2 ** attempt);
    }
  }

  throw lastError;
}

function assertRequestId(response, payload, label) {
  assert(typeof payload?.requestId === "string", `${label}: missing body requestId`);
  assert(payload.requestId.startsWith("req_"), `${label}: invalid requestId prefix`);
  assert(
    response.headers.get("x-request-id") === payload.requestId,
    `${label}: x-request-id header does not match body requestId`,
  );
}

async function assertError(apiUrl, input, expected, label) {
  const { response, payload } = await apiRequest(apiUrl, input);
  assert(response.status === expected.status, `${label}: expected status ${expected.status}, got ${response.status}`);
  assert(payload?.success === false, `${label}: expected success=false`);
  assert(payload?.error?.code === expected.code, `${label}: expected code ${expected.code}, got ${payload?.error?.code}`);
  assertRequestId(response, payload, label);
  return { response, payload };
}

async function assertSuccess(apiUrl, input, label) {
  const { response, payload } = await apiRequest(apiUrl, input);
  assert(response.ok, `${label}: expected 2xx, got ${response.status}`);
  assert(payload?.success === true, `${label}: expected success=true`);
  assertRequestId(response, payload, label);
  return payload.data;
}

async function main() {
  const apiUrl = getSiteUrl();
  const testRunId = Date.now();
  const userId = `test_cli_errors_${testRunId}`;
  const seededTokens = [];
  let documentId;

  try {
    console.log("[1/8] Missing and invalid token errors");
    await assertError(
      apiUrl,
      { path: "/cli/v1/auth/status" },
      { status: 401, code: "UNAUTHORIZED" },
      "missing token",
    );
    await assertError(
      apiUrl,
      { path: "/cli/v1/auth/status", token: `mnt_invalid_${randomBytes(8).toString("hex")}` },
      { status: 401, code: "UNAUTHORIZED" },
      "invalid token",
    );

    console.log("[2/8] Seed read-only token and assert insufficient scope");
    const readOnlyToken = seedToken({
      name: "My-Notion CLI Error E2E Read Only",
      userId,
      scopes: ["docs:read"],
    });
    seededTokens.push(readOnlyToken);
    await assertError(
      apiUrl,
      {
        method: "POST",
        path: "/cli/v1/documents",
        token: readOnlyToken.token,
        body: { title: `Should Not Create ${testRunId}` },
      },
      { status: 403, code: "INSUFFICIENT_SCOPE" },
      "insufficient scope",
    );

    console.log("[3/8] Seed expired token and assert token expiry");
    const expiredToken = seedToken({
      name: "My-Notion CLI Error E2E Expired",
      userId,
      scopes: ["docs:read", "docs:write"],
      expiresAt: Date.now() - 1_000,
    });
    seededTokens.push(expiredToken);
    await assertError(
      apiUrl,
      { path: "/cli/v1/auth/status", token: expiredToken.token },
      { status: 401, code: "TOKEN_EXPIRED" },
      "expired token",
    );

    console.log("[4/8] Seed and revoke token, then assert revoked token");
    const revokedToken = seedToken({
      name: "My-Notion CLI Error E2E Revoked",
      userId,
      scopes: ["docs:read", "docs:write"],
    });
    seededTokens.push(revokedToken);
    revokeToken(revokedToken);
    await assertError(
      apiUrl,
      { path: "/cli/v1/auth/status", token: revokedToken.token },
      { status: 401, code: "TOKEN_REVOKED" },
      "revoked token",
    );

    console.log("[5/8] Seed full token and assert validation error");
    const fullToken = seedToken({
      name: "My-Notion CLI Error E2E Full",
      userId,
      scopes: ["docs:read", "docs:write"],
    });
    seededTokens.push(fullToken);
    await assertError(
      apiUrl,
      {
        method: "POST",
        path: "/cli/v1/documents",
        token: fullToken.token,
        body: { title: "   " },
      },
      { status: 422, code: "VALIDATION_ERROR" },
      "validation error",
    );

    console.log("[6/8] Create, archive, and assert not found");
    const created = await assertSuccess(
      apiUrl,
      {
        method: "POST",
        path: "/cli/v1/documents",
        token: fullToken.token,
        body: {
          title: `CLI Error E2E ${testRunId}`,
          contentMarkdown: `Temporary document for ${testRunId}`,
        },
      },
      "create document",
    );
    documentId = created.id;
    await assertSuccess(
      apiUrl,
      {
        method: "DELETE",
        path: `/cli/v1/documents/${encodeURIComponent(documentId)}`,
        token: fullToken.token,
      },
      "archive document",
    );
    await assertError(
      apiUrl,
      {
        path: `/cli/v1/documents/${encodeURIComponent(documentId)}`,
        token: fullToken.token,
      },
      { status: 404, code: "NOT_FOUND" },
      "not found",
    );

    console.log("[7/8] Seed rate-limit token and assert 429 headers");
    const rateLimitToken = seedToken({
      name: "My-Notion CLI Error E2E Rate Limit",
      userId,
      scopes: ["docs:read", "docs:write"],
    });
    seededTokens.push(rateLimitToken);

    let rateLimited;
    for (let attempt = 1; attempt <= 90; attempt += 1) {
      const result = await apiRequest(apiUrl, {
        method: "POST",
        path: "/cli/v1/documents",
        token: rateLimitToken.token,
        body: { title: "   " },
      });
      if (result.response.status === 429) {
        rateLimited = result;
        break;
      }

      assert(result.response.status === 422, `rate limit warmup ${attempt}: expected 422 or 429, got ${result.response.status}`);
      assert(result.payload?.error?.code === "VALIDATION_ERROR", `rate limit warmup ${attempt}: expected VALIDATION_ERROR before RATE_LIMITED`);
    }

    assert(rateLimited, "rate limit response was not captured within 90 write attempts");
    assert(rateLimited.response.status === 429, `rate limit: expected 429, got ${rateLimited.response.status}`);
    assert(rateLimited.payload?.error?.code === "RATE_LIMITED", "rate limit: expected RATE_LIMITED");
    assertRequestId(rateLimited.response, rateLimited.payload, "rate limit");
    for (const header of [
      "Retry-After",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "x-ratelimit-reset",
    ]) {
      assert(rateLimited.response.headers.get(header) !== null, `rate limit: missing ${header}`);
    }

    console.log("[8/8] Error contract assertions passed");
    console.log(
      JSON.stringify(
        {
          success: true,
          apiUrl,
          testRunId,
          documentId,
          covered: [
            "UNAUTHORIZED",
            "INSUFFICIENT_SCOPE",
            "TOKEN_EXPIRED",
            "TOKEN_REVOKED",
            "VALIDATION_ERROR",
            "NOT_FOUND",
            "RATE_LIMITED",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    for (const tokenRecord of seededTokens) {
      try {
        revokeToken(tokenRecord);
      } catch (error) {
        console.error(`Failed to revoke test token ${tokenRecord.tokenPrefix}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
