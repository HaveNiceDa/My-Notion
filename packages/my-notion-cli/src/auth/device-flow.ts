import { spawn } from "node:child_process";
import { hostname } from "node:os";
import {
  readStringOption,
  resolveProfile,
  saveProfileAuth,
} from "../config/store.js";
import type {
  DeviceAuthorizationPollResult,
  DeviceAuthorizationStartResult,
  ParsedArgs,
  ResolvedProfile,
} from "../types.js";

const DEFAULT_POLL_INTERVAL_SECONDS = 3;

type DeviceApiResponse<T> =
  | { success: true; data: T; requestId?: string }
  | {
      success: false;
      requestId?: string;
      error?: {
        code?: string;
        message?: string;
      };
    };

export class DeviceAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DeviceAuthorizationError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldOpenBrowser(args: ParsedArgs) {
  if (args.options["no-open"] === true) return false;
  if (args.options["open"] === false) return false;
  return Boolean(process.stdout.isTTY);
}

function openBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function requestDeviceApi<T>(
  webUrl: string,
  path: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${webUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | DeviceApiResponse<T>
    | null;

  if (!response.ok || !payload?.success) {
    const code = payload?.success === false ? payload.error?.code : undefined;
    const message =
      payload?.success === false
        ? payload.error?.message ?? code ?? "Device authorization failed"
        : `HTTP ${response.status}`;
    throw new DeviceAuthorizationError(message, code, response.status);
  }

  return payload.data;
}

export async function startDeviceAuthorization(profile: ResolvedProfile) {
  return requestDeviceApi<DeviceAuthorizationStartResult>(
    profile.webUrl,
    "/api/cli/auth/device/start",
    {
      profile: profile.name,
      apiUrl: profile.apiUrl,
      webUrl: profile.webUrl,
      machineName: hostname(),
      clientName: "my-notion-cli",
      scopes: ["docs:read", "docs:write"],
    },
  );
}

export async function pollDeviceAuthorization(
  profile: ResolvedProfile,
  deviceCode: string,
) {
  return requestDeviceApi<DeviceAuthorizationPollResult>(
    profile.webUrl,
    "/api/cli/auth/device/poll",
    {
      deviceCode,
    },
  );
}

function printDeviceLoginPrompt(input: {
  profile: ResolvedProfile;
  authorization: DeviceAuthorizationStartResult;
}) {
  const expiresAt = new Date(input.authorization.expiresAt).toLocaleString();
  console.log(`My-Notion CLI browser login

Profile: ${input.profile.name}
Web URL: ${input.profile.webUrl}
API URL: ${input.profile.apiUrl}

Open this authorization URL:
${input.authorization.verificationUriComplete}

User code: ${input.authorization.userCode}
Expires at: ${expiresAt}
`);
}

export async function runDeviceLogin(args: ParsedArgs) {
  const profile = resolveProfile(args.options);
  const existingDeviceCode = readStringOption(args.options, "device-code");
  const authorization = existingDeviceCode
    ? undefined
    : await startDeviceAuthorization(profile);
  const deviceCode = existingDeviceCode ?? authorization?.deviceCode;

  if (!deviceCode) {
    throw new Error("Missing device code.");
  }

  if (authorization) {
    printDeviceLoginPrompt({ profile, authorization });
    if (shouldOpenBrowser(args)) {
      openBrowser(authorization.verificationUriComplete);
    }
  }

  if (args.options["no-wait"] === true) {
    console.log(
      [
        `Device login started. Resume polling with: my-notion auth login --profile ${profile.name} --device-code <device-code>`,
        "The device code is a sensitive temporary credential; do not paste it into chats or logs.",
      ].join("\n"),
    );
    return {
      authenticated: false,
      pending: true,
      profile: profile.name,
      deviceCode,
      verificationUriComplete: authorization?.verificationUriComplete,
    };
  }

  let intervalSeconds =
    authorization?.intervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;

  for (;;) {
    await sleep(intervalSeconds * 1000);

    try {
      const result = await pollDeviceAuthorization(profile, deviceCode);
      if (result.status === "pending") {
        intervalSeconds = result.intervalSeconds ?? intervalSeconds;
        continue;
      }

      saveProfileAuth({
        profileName: profile.name,
        apiUrl: profile.apiUrl,
        webUrl: profile.webUrl,
        token: result.token,
        tokenPrefix: result.tokenPrefix,
        scopes: result.scopes,
        expiresAt: result.expiresAt,
        authMethod: "device",
      });

      return {
        authenticated: true,
        profile: profile.name,
        apiUrl: profile.apiUrl,
        webUrl: profile.webUrl,
        tokenPrefix: result.tokenPrefix,
        scopes: result.scopes,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      if (
        error instanceof DeviceAuthorizationError &&
        error.code === "AUTHORIZATION_PENDING"
      ) {
        intervalSeconds = Math.max(intervalSeconds, DEFAULT_POLL_INTERVAL_SECONDS);
        continue;
      }
      throw error;
    }
  }
}
