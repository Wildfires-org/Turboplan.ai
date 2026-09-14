import type { Context, Next } from "hono";

import { extractTokenFromHeader, verifyToken } from "./jwt";

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
 * Optional auth middleware - sets user context if token is valid, but doesn't require auth.
 * Use this for public routes that can optionally show user-specific content.
 */
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  if (c.req.method === "OPTIONS") {
    return next();
  }

  const authHeader = c.req.header("authorization");
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      c.set("user", { userId: payload.id, userRole: payload.userRole });
    }
  }

  await next();
};
