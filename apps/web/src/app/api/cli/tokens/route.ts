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
};

type AuthenticatedConvexClientResult =
  | { convex: ConvexHttpClient }
  | { error: NextResponse }
  | { unavailable: string };

function createPlainToken() {
  return `mnt_${randomBytes(32).toString("base64url")}`;
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isNetworkUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && "cause" in error ? String(error.cause) : "";
  return /fetch failed|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|network|unexpected_error/i.test(
    `${message} ${cause}`,
  );
}

function serviceUnavailableMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
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
    convexAuthToken = await getToken({ template: "convex" });
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
      console.warn("[CLI Token] Degraded token list:", result.unavailable);
      return NextResponse.json({
        success: true,
        data: { tokens: [], unavailable: true, warning: result.unavailable },
      });
    }

    let tokens;
    try {
      tokens = await result.convex.query(api.cli.listApiTokenRecords, {});
    } catch (error) {
      if (isNetworkUnavailableError(error)) {
        const warning = serviceUnavailableMessage(error);
        console.warn("[CLI Token] Degraded token list:", warning);
        return NextResponse.json({
          success: true,
          data: { tokens: [], unavailable: true, warning },
        });
      }
      throw error;
    }
    return NextResponse.json({ success: true, data: { tokens } });
  } catch (error) {
    console.error("[CLI Token] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
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

    const record = await result.convex.mutation(api.cli.createApiTokenRecord, {
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
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
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
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
