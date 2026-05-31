import { createHash, randomBytes } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const DEVICE_AUTH_EXPIRES_IN_MS = 10 * 60 * 1000;
export const DEVICE_AUTH_INTERVAL_SECONDS = 3;

export function createPlainToken() {
  return `mnt_${randomBytes(32).toString("base64url")}`;
}

export function createDeviceCode() {
  return `mnd_${randomBytes(32).toString("base64url")}`;
}

export function createUserCode() {
  const raw = randomBytes(5).toString("hex").toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  }
  return new ConvexHttpClient(convexUrl);
}

export async function getAuthenticatedConvexClient() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return null;
  }

  const convex = getConvexClient();
  const convexAuthToken = await getToken({ template: "convex" });
  if (!convexAuthToken) {
    throw new Error("Failed to get Convex auth token");
  }
  convex.setAuth(convexAuthToken);
  return convex;
}

export const cliApi = (api as typeof api & {
  cli: Record<string, any>;
}).cli;

export function success(data: unknown, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function failure(code: string, message: string, status = 400) {
  return Response.json(
    {
      success: false,
      error: { code, message },
    },
    { status },
  );
}
