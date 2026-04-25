import { NextRequest, NextResponse } from "next/server";
import { initEdgeStoreClient } from "@edgestore/server/core";
import { edgeStoreRouter } from "@/src/lib/edgestore-router";

const edgestoreClient = initEdgeStoreClient({
  router: edgeStoreRouter,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 },
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

    return NextResponse.json({ url: res.url });
  } catch (error) {
    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}
