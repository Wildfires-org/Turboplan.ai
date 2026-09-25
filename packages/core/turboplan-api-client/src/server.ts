import type { Context, Next } from "hono";

import { extractTokenFromHeader, type TokenPayload, verifyToken } from "./jwt";

export interface AuthContext {
  userId: string;
  email?: string;
  /**
   * Optional user role from the profile, populated from the API token when
   * present. Routes that need it should fall back to a DB lookup if absent.
   */
  userRole?: string;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthContext;
  }
}

/**
 * Only general-purpose tokens identify a user on optional-auth routes. Scoped
 * tokens (e.g. short-lived upload tokens, which travel in URLs and can leak via
 * logs) are ignored. Tokens without a purpose predate scoping and count as
 * general, matching the server's required-auth middleware.
 */
export const isGeneralPurposeToken = (payload: TokenPayload) => {
  return payload.purpose === undefined || payload.purpose === "general";
};

/**
 * Optional auth middleware - sets user context if token is valid, but doesn't require auth.
 * Use this for public routes that can optionally show user-specific content.
 * Tokens are read from the Authorization header only, never from the query
 * string, and non-general tokens are treated as absent (no 401).
 */
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  if (c.req.method === "OPTIONS") {
    return next();
  }

  const authHeader = c.req.header("authorization");
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const payload = await verifyToken(token);
    if (payload && isGeneralPurposeToken(payload)) {
      c.set("user", { userId: payload.id, userRole: payload.userRole });
    }
  }

  await next();
};
