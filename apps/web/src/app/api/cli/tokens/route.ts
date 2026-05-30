import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type CreateTokenBody = {
  name?: string;
  scopes?: string[];
  expiresAt?: number;
  resetDefault?: boolean;
};

type AuthenticatedConvexClientResult =
  | { convex: ConvexHttpClient }
  | { error: NextResponse }
  | { unavailable: string };

const CLERK_CONVEX_TOKEN_RETRY_DELAYS_MS = [200, 600];

function createPlainToken() {
  return `mnt_${randomBytes(32).toString("base64url")}`;
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getErrorText(error: unknown): string {
  if (!error) return "";

  const messages: string[] = [];
  if (error instanceof Error) {
    messages.push(error.message);
    if ("cause" in error && error.cause) {
      messages.push(String(error.cause));
    }
  } else {
    messages.push(String(error));
  }

  if (typeof error === "object" && error !== null && "errors" in error) {
    const clerkErrors = (error as { errors?: Array<{ code?: string; message?: string }> })
      .errors;
    if (Array.isArray(clerkErrors)) {
      for (const clerkError of clerkErrors) {
        messages.push(clerkError.code ?? "", clerkError.message ?? "");
      }
    }
  }

  return messages.filter(Boolean).join(" ");
}

function isNetworkUnavailableError(error: unknown): boolean {
  return /fetch failed|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|network|unexpected_error/i.test(
    getErrorText(error),
  );
}

function serviceUnavailableMessage(error: unknown): string {
  if (typeof error === "string" && error.startsWith("CLI token service")) {
    return error;
  }

  const message = getErrorText(error) || "authentication service unavailable";
  return `CLI token service is temporarily unavailable: ${message}`;
}

function serviceUnavailableResponse(error: unknown) {
  return NextResponse.json(
    {
      success: false,
      code: "SERVICE_UNAVAILABLE",
      error: serviceUnavailableMessage(error),
    },
    { status: 503 },
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getConvexAuthTokenWithRetry(
  getToken: (options: { template: string }) => Promise<string | null>,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= CLERK_CONVEX_TOKEN_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await getToken({ template: "convex" });
    } catch (error) {
      lastError = error;
      if (!isNetworkUnavailableError(error)) {
        throw error;
      }

      const delay = CLERK_CONVEX_TOKEN_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;

      console.warn(
        `[CLI Token] Clerk Convex JWT fetch failed, retrying in ${delay}ms:`,
        getErrorText(error),
      );
      await wait(delay);
    }
  }

  throw new Error(
    `Clerk Convex JWT fetch failed after ${
      CLERK_CONVEX_TOKEN_RETRY_DELAYS_MS.length + 1
    } attempts: ${getErrorText(lastError) || "unknown error"}`,
  );
}

function tokenListUnavailableResponse(error: unknown) {
  const warning = serviceUnavailableMessage(error);
  console.warn("[CLI Token] Degraded token list:", warning);
  return NextResponse.json({
    success: true,
    data: {
      tokens: [],
      unavailable: true,
      reason: isNetworkUnavailableError(error) ? "NETWORK_UNAVAILABLE" : "SERVICE_UNAVAILABLE",
      warning,
    },
  });
}

function tokenRouteErrorResponse(error: unknown) {
  const message = getErrorText(error);

  if (/Unauthenticated|Unauthorized/i.test(message)) {
    return NextResponse.json(
      { success: false, code: "UNAUTHORIZED", error: "Unauthorized" },
      { status: 401 },
    );
  }

  if (isNetworkUnavailableError(error)) {
    return serviceUnavailableResponse(error);
  }

  return NextResponse.json(
    { success: false, code: "INTERNAL_ERROR", error: message || "Internal server error" },
    { status: 500 },
  );
}

async function getAuthenticatedConvexClient(): Promise<AuthenticatedConvexClientResult> {
  const { userId, getToken } = await auth();
  if (!userId) {
    return {
      error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return {
      error: NextResponse.json(
        { success: false, error: "NEXT_PUBLIC_CONVEX_URL is not configured" },
        { status: 500 },
      ),
    };
  }

  let convexAuthToken: string | null;
  try {
    convexAuthToken = await getConvexAuthTokenWithRetry(getToken);
  } catch (error) {
    if (isNetworkUnavailableError(error)) {
      return { unavailable: serviceUnavailableMessage(error) };
    }
    throw error;
  }
  if (!convexAuthToken) {
    return {
      error: NextResponse.json(
        { success: false, error: "Failed to get Convex auth token" },
        { status: 401 },
      ),
    };
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(convexAuthToken);

  return { convex };
}

export async function GET() {
  try {
    const result = await getAuthenticatedConvexClient();
    if ("error" in result) return result.error;
    if ("unavailable" in result) {
      return tokenListUnavailableResponse(result.unavailable);
    }

    let token;
    try {
      const plainToken = createPlainToken();
      token = await result.convex.mutation(api.cli.ensureDefaultApiTokenRecord, {
        tokenHash: sha256Hex(plainToken),
        tokenPrefix: plainToken.slice(0, 12),
        tokenPlaintext: plainToken,
      });
    } catch (error) {
      return tokenListUnavailableResponse(error);
    }
    return NextResponse.json({ success: true, data: { tokens: [token] } });
  } catch (error) {
    if (!isNetworkUnavailableError(error)) {
      console.error("[CLI Token] Error:", error);
    }
    return tokenListUnavailableResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await getAuthenticatedConvexClient();
    if ("error" in result) return result.error;
    if ("unavailable" in result) return serviceUnavailableResponse(result.unavailable);

    const body = (await req.json().catch(() => ({}))) as CreateTokenBody;
    const plainToken = createPlainToken();
    const tokenPrefix = plainToken.slice(0, 12);

    const record = body.resetDefault
      ? await result.convex.mutation(api.cli.resetDefaultApiTokenRecord, {
          tokenHash: sha256Hex(plainToken),
          tokenPrefix,
          tokenPlaintext: plainToken,
        })
      : await result.convex.mutation(api.cli.createApiTokenRecord, {
          name: body.name?.trim() || "My-Notion CLI Token",
          tokenHash: sha256Hex(plainToken),
          tokenPrefix,
          scopes: body.scopes,
          expiresAt: body.expiresAt,
        });

    return NextResponse.json({
      success: true,
      data: {
        ...record,
        token: plainToken,
        tokenPrefix,
      },
    });
  } catch (error) {
    console.error("[CLI Token] Error:", error);
    return tokenRouteErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const result = await getAuthenticatedConvexClient();
    if ("error" in result) return result.error;
    if ("unavailable" in result) return serviceUnavailableResponse(result.unavailable);

    const url = new URL(req.url);
    const body = (await req.json().catch(() => ({}))) as { tokenId?: string };
    const tokenId = url.searchParams.get("tokenId") ?? body.tokenId;
    if (!tokenId) {
      return NextResponse.json(
        { success: false, error: "tokenId is required" },
        { status: 400 },
      );
    }

    const token = await result.convex.mutation(api.cli.revokeApiTokenRecord, {
      tokenId: tokenId as Id<"apiTokens">,
    });

    return NextResponse.json({ success: true, data: { token } });
  } catch (error) {
    console.error("[CLI Token] Error:", error);
    return tokenRouteErrorResponse(error);
  }
}
