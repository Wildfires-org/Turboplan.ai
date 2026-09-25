import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import { PATHNAME_HEADER } from "@wildfires-org/turboplan-utils/server";

import { stripTelemetryHeaders } from "@/lib/telemetry-proxy";
import { authConfig } from "./app/(auth)/auth.config";

// CORS headers for preflight requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

// NextAuth sign-in endpoints. The app only signs in via server actions, whose
// `signIn()` calls Auth() in-process (next-auth 5.0.0-beta.32, lib/actions.js)
// and never reaches these routes over HTTP, so external POSTs are refused.
const BLOCKED_AUTH_POST_PREFIXES = ["/api/auth/callback", "/api/auth/signin"];

const isBlockedAuthPost = (request: NextRequest) => {
  if (request.method !== "POST") {
    return false;
  }
  const { pathname } = request.nextUrl;
  return BLOCKED_AUTH_POST_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
};

// Create auth handler
const { auth } = NextAuth(authConfig);

// Auth middleware that adds pathname header and handles auth
// Note: Slug redirects are handled in layouts (not middleware) due to Edge runtime limitations
const authMiddleware = auth((request) => {
  // Add pathname header for server components to access current path
  const response = NextResponse.next();
  response.headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return response;
});

// Wrapper middleware to handle OPTIONS preflight requests before auth
export function middleware(request: NextRequest, event: NextFetchEvent) {
  // Telemetry proxy: strip cookies so the session JWT never reaches the
  // third-party ingestion host through the /ingest rewrite.
  if (request.nextUrl.pathname.startsWith("/ingest")) {
    return NextResponse.next({
      request: { headers: stripTelemetryHeaders(request.headers) },
    });
  }

  if (isBlockedAuthPost(request)) {
    return new NextResponse(null, { status: 404 });
  }

  // Handle CORS preflight requests immediately
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // For all other requests, proceed with auth middleware
  // Type assertion needed as NextAuth expects AppRouteHandlerFnContext
  return authMiddleware(
    request,
    event as unknown as Parameters<typeof authMiddleware>[1],
  );
}

export const config = {
  // Exclude /api/verify-session from auth middleware matcher
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/verify-session (our auth verification endpoint)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/verify-session|_next/static|_next/image|favicon.ico).*)",
  ],
};
