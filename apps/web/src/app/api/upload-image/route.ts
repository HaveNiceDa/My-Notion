import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { initEdgeStoreClient } from "@edgestore/server/core";
import { edgeStoreRouter } from "@/src/lib/edgestore-router";

const edgestoreClient = initEdgeStoreClient({
  router: edgeStoreRouter,
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400, headers: CORS_HEADERS },
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

    return NextResponse.json({ url: res.url }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
