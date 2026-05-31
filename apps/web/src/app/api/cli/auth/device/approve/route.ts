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

    const result = await convex.mutation(cliApi.approveCliDeviceAuthSession, {
      userCodeHash: sha256Hex(body.userCode),
    });

    if (!result.ok) {
      return failure(result.code, result.code, 400);
    }

    return success({ approved: true });
  } catch (error) {
    return failure(
      "DEVICE_AUTH_APPROVE_FAILED",
      error instanceof Error ? error.message : "Failed to approve device authorization",
      500,
    );
  }
}
