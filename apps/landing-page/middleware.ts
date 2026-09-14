import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { stripTelemetryHeaders } from "@/lib/telemetry-proxy";

// CORS headers for preflight requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

export function middleware(request: NextRequest) {
  // Telemetry proxy: strip cookies so session cookies never reach the
  // third-party ingestion host through the /ingest rewrite.
  if (request.nextUrl.pathname.startsWith("/ingest")) {
    return NextResponse.next({
      request: { headers: stripTelemetryHeaders(request.headers) },
    });
  }

  // Handle CORS preflight requests immediately
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths to handle OPTIONS requests
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
