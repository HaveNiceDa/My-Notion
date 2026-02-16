import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  
  const sentryUrl = "https://o4509937237950464.ingest.us.sentry.io/api/4510894903132160/envelope/";
  
  try {
    const response = await fetch(sentryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
      },
      body: body,
    });
    
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Sentry tunnel error:", error);
    return NextResponse.json(
      { error: "Failed to forward to Sentry" },
      { status: 500 }
    );
  }
}
