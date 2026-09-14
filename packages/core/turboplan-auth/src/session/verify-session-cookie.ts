import { decode } from "@auth/core/jwt";

import { getApiEnv, getAuthCookieName } from "@wildfires-org/turboplan-env";

import type { JWTPayload, Session } from "../types";

/**
 * Verify a raw session cookie JWT.
 *
 * Use this function in non-Next.js contexts (e.g., Hono server) where you have
 * direct access to the cookie value but not the Next.js cookies() API.
 *
 * @param token - The raw JWT cookie value (from the session cookie)
 * @returns Session with user data, or null if invalid/expired
 *
 * @example
 * ```typescript
 * // In Hono route handler
 * import { getCookie } from "hono/cookie";
 * import { verifySessionCookie } from "@wildfires-org/turboplan-auth/hono";
 * import { getAuthCookieName } from "@wildfires-org/turboplan-env";
 *
 * app.get("/api/auth/token", async (c) => {
 *   const sessionCookie = getCookie(c, getAuthCookieName());
 *
 *   if (!sessionCookie) {
 *     return c.json({ error: "No session cookie" }, 401);
 *   }
 *
 *   const session = await verifySessionCookie(sessionCookie);
 *
 *   if (!session) {
 *     return c.json({ error: "Invalid session" }, 401);
 *   }
 *
 *   // Issue API token for the authenticated user
 *   return c.json({ userId: session.user.id });
 * });
 * ```
 */
export const verifySessionCookie = async (token: string): Promise<Session> => {
  try {
    if (!token) {
      return null;
    }

    const { AUTH_SECRET } = getApiEnv();

    // Decode the JWT using the shared secret
    const decoded = await decode<JWTPayload>({
      token,
      secret: AUTH_SECRET,
      // Salt must match what NextAuth uses for the session token
      salt: getAuthCookieName(),
    });

    if (!decoded) {
      return null;
    }

    // Check if token is expired
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    // Extract user data from the decoded token
    const userId = decoded.id || decoded.sub;

    if (!userId) {
      return null;
    }

    return {
      user: {
        id: userId,
        email: decoded.email,
        userRole: decoded.userRole,
      },
      // Profile is not fetched here - caller can fetch separately if needed
      profile: null,
    };
  } catch (error) {
    // Log error in development for debugging
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to verify session cookie:", error);
    }
    return null;
  }
};
