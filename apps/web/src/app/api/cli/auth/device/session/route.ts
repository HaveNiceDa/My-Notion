import { NextRequest } from "next/server";
import {
  cliApi,
  failure,
  getAuthenticatedConvexClient,
  sha256Hex,
  success,
} from "../_shared";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { userCode?: string };
    if (!body.userCode) {
      return failure("INVALID_USER_CODE", "userCode is required", 400);
    }

    const convex = await getAuthenticatedConvexClient();
    if (!convex) {
      return failure("UNAUTHORIZED", "Unauthorized", 401);
    }

    const session = await convex.query(cliApi.getCliDeviceAuthSessionByUserCode, {
      userCodeHash: sha256Hex(body.userCode),
    });

    if (!session) {
      return failure("DEVICE_AUTH_SESSION_NOT_FOUND", "Authorization session not found", 404);
    }

    return success({ session });
  } catch (error) {
    return failure(
      "DEVICE_AUTH_SESSION_FAILED",
      error instanceof Error ? error.message : "Failed to load authorization session",
      500,
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
