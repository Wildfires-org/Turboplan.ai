import type { Context } from "hono";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import { createToken } from "@wildfires-org/turboplan-api-client";
import { verifySessionCookie } from "@wildfires-org/turboplan-auth/hono";
import { getAuthCookieName } from "@wildfires-org/turboplan-env";

export const tokenRouter = new Hono();

/**
 * GET /api/auth/token - Issue API token from session cookie
 *
 * This is a PUBLIC endpoint (no authMiddleware) that converts a valid
 * session cookie into a short-lived API token.
 *
 * Flow:
 * 1. Client sends request with session cookie (via credentials: "include")
 * 2. Server reads and verifies the session cookie
 * 3. Server issues a short-lived JWT token for API access
 *
 * This enables:
 * - Token refresh without re-authentication
 * - Cross-app token issuance (landing page can get tokens too)
 * - Centralized token generation in Hono server
 */
tokenRouter.get("/token", async (c: Context) => {
  try {
    // Read session cookie from request
    const sessionCookie = getCookie(c, getAuthCookieName());

    if (!sessionCookie) {
      return c.json({ error: "No session cookie" }, 401);
    }

    // Verify and decode the session using shared auth package
    const session = await verifySessionCookie(sessionCookie);

    if (!session?.user?.id) {
      return c.json({ error: "Invalid session" }, 401);
    }

    // Issue short-lived API token (15min expiry).
    // userRole is sourced from the session JWT (no DB hop here) and embedded
    // in the API token so downstream Hono routes can branch on role without
    // a per-request profile lookup.
    const token = await createToken({
      id: session.user.id,
      userRole: session.user.userRole,
    });

    return c.json({
      token,
      user: {
        id: session.user.id,
      },
    });
  } catch (error) {
    console.error("Token generation error:", error);
    return c.json({ error: "Failed to generate token" }, 500);
  }
});
