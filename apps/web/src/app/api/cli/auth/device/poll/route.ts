import { NextRequest } from "next/server";
import {
  DEVICE_AUTH_INTERVAL_SECONDS,
  cliApi,
  createPlainToken,
  failure,
  getConvexClient,
  sha256Hex,
  success,
} from "../_shared";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { deviceCode?: string };
    if (!body.deviceCode) {
      return failure("INVALID_DEVICE_CODE", "deviceCode is required", 400);
    }

    const convex = getConvexClient();
    const deviceCodeHash = sha256Hex(body.deviceCode);
    const pollResult = await convex.mutation(cliApi.pollCliDeviceAuthSession, {
      deviceCodeHash,
    });

    if (pollResult.status === "pending") {
      return failure(
        "AUTHORIZATION_PENDING",
        "Authorization is still pending",
        428,
      );
    }

    if (pollResult.status === "invalid") {
      return failure("INVALID_DEVICE_CODE", "Device code is invalid", 400);
    }

    if (pollResult.status === "denied") {
      return failure("AUTHORIZATION_DENIED", "Authorization was denied", 403);
    }

    if (pollResult.status === "expired") {
      return failure("DEVICE_CODE_EXPIRED", "Device code has expired", 400);
    }

    if (pollResult.status === "consumed") {
      return failure("DEVICE_CODE_CONSUMED", "Device code was already consumed", 400);
    }

    const token = createPlainToken();
    const tokenPrefix = token.slice(0, 12);
    const consumeResult = await convex.mutation(
      cliApi.consumeCliDeviceAuthSessionAndCreateToken,
      {
        deviceCodeHash,
        tokenHash: sha256Hex(token),
        tokenPrefix,
      },
    );

    if (!consumeResult.ok) {
      return failure(
        consumeResult.code ?? "DEVICE_AUTH_CONSUME_FAILED",
        consumeResult.code ?? "Failed to consume device authorization",
        consumeResult.code === "AUTHORIZATION_PENDING" ? 428 : 400,
      );
    }

    return success({
      status: "approved",
      token,
      tokenPrefix,
      scopes: consumeResult.token.scopes,
      expiresAt: consumeResult.token.expiresAt,
    });
  } catch (error) {
    return failure(
      "DEVICE_AUTH_POLL_FAILED",
      error instanceof Error ? error.message : "Failed to poll device authorization",
      500,
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
