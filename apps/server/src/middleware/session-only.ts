import type { Context, Next } from "hono";

/**
 * Rejects requests authenticated with a personal access token. Use on routes a
 * PAT must never reach: PAT management (a leaked PAT could otherwise mint a
 * fresh token that outlives its own revocation) and the admin panel. Must run
 * after authMiddleware, which sets `authMethod`.
 */
export const requireSessionAuth = async (c: Context, next: Next) => {
  if (c.req.method === "OPTIONS") {
    return next();
  }

  if (c.get("authMethod") === "pat") {
    return c.json(
      {
        error:
          "Forbidden - Personal access tokens cannot be used for this endpoint",
      },
      403,
    );
  }

  await next();
};
