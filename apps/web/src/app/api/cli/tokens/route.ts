import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

type CreateTokenBody = {
  name?: string;
  scopes?: string[];
  expiresAt?: number;
};

function createPlainToken() {
  return `mnt_${randomBytes(32).toString("base64url")}`;
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { success: false, error: "NEXT_PUBLIC_CONVEX_URL is not configured" },
        { status: 500 },
      );
    }

    const convexAuthToken = await getToken({ template: "convex" });
    if (!convexAuthToken) {
      return NextResponse.json(
        { success: false, error: "Failed to get Convex auth token" },
        { status: 401 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as CreateTokenBody;
    const plainToken = createPlainToken();
    const tokenPrefix = plainToken.slice(0, 12);
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexAuthToken);

    const record = await convex.mutation(api.cli.createApiTokenRecord, {
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
