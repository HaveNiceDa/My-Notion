import { NextRequest } from "next/server";
import {
  DEVICE_AUTH_EXPIRES_IN_MS,
  DEVICE_AUTH_INTERVAL_SECONDS,
  cliApi,
  createDeviceCode,
  createUserCode,
  failure,
  getConvexClient,
  sha256Hex,
  success,
} from "../_shared";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      profile?: string;
      apiUrl?: string;
      webUrl?: string;
      machineName?: string;
      clientName?: string;
      clientVersion?: string;
      scopes?: string[];
    };
    const webUrl = (body.webUrl ?? new URL(req.url).origin).replace(/\/+$/, "");
    const deviceCode = createDeviceCode();
    const userCode = createUserCode();
    const expiresAt = Date.now() + DEVICE_AUTH_EXPIRES_IN_MS;
    const verificationUri = `${webUrl}/cli/auth`;
    const verificationUriComplete = `${verificationUri}?user_code=${encodeURIComponent(
      userCode,
    )}`;

    await getConvexClient().mutation(cliApi.createCliDeviceAuthSession, {
      deviceCodeHash: sha256Hex(deviceCode),
      userCodeHash: sha256Hex(userCode),
      userCodeDisplay: userCode,
      scopes: body.scopes?.length ? body.scopes : ["docs:read", "docs:write"],
      profile: body.profile,
      apiUrl: body.apiUrl,
      webUrl,
      clientName: body.clientName,
      clientVersion: body.clientVersion,
      machineName: body.machineName,
      expiresAt,
    });

    return success(
      {
        deviceCode,
        userCode,
        verificationUri,
        verificationUriComplete,
        expiresAt,
        intervalSeconds: DEVICE_AUTH_INTERVAL_SECONDS,
      },
      201,
    );
  } catch (error) {
    return failure(
      "DEVICE_AUTH_START_FAILED",
      error instanceof Error ? error.message : "Failed to start device authorization",
      500,
    );
  }
}
