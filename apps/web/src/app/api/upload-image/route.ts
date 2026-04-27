import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { initEdgeStoreClient } from "@edgestore/server/core";
import { edgeStoreRouter } from "@/src/lib/edgestore-router";

const edgestoreClient = initEdgeStoreClient({
  router: edgeStoreRouter,
});

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8081",
  "http://localhost:19000",
  "http://localhost:19006",
  "https://notion-j9zj.vercel.app",
];

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400, headers: corsHeaders },
      );
    }

    const extension = (formData.get("extension") as string) || "bin";
    const name = (formData.get("name") as string) || `upload-${Date.now()}.${extension}`;

    const res = await edgestoreClient.publicFiles.upload({
      content: {
        blob: file,
        extension,
      },
      options: {
        manualFileName: name,
      },
    });

    return NextResponse.json({ url: res.url }, { headers: corsHeaders });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500, headers: corsHeaders },
    );
  }
}
