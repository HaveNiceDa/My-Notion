import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default clerkMiddleware((auth, request) => {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/monitoring" ||
    pathname.match(/^\/[a-z]{2}(-[A-Z]{2})?\/monitoring$/)
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
});

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
