import type { Context, Next } from "hono";

import {
  extractTokenFromHeader,
  hashPAT,
  isPATToken,
  verifyToken,
} from "@wildfires-org/turboplan-api-client";
import {
  findPATByHash,
  updatePATLastUsed,
} from "@wildfires-org/turboplan-db/queries";

export const authMiddleware = async (c: Context, next: Next) => {
  if (c.req.method === "OPTIONS") {
    return next();
  }

  const authHeader = c.req.header("authorization");
  const headerToken = extractTokenFromHeader(authHeader);

  if (headerToken && isPATToken(headerToken)) {
    const hash = hashPAT(headerToken);
    const pat = await findPATByHash(hash);
    if (!pat) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }
    updatePATLastUsed(pat.id).catch((err) =>
      console.error("Failed to update PAT lastUsedAt:", err),
    );
    c.set("user", {
      userId: pat.userId,
      email: pat.email,
      userRole: pat.userRole ?? undefined,
    });
    c.set("authMethod", "pat");
    await next();
    return;
  }

  let token = headerToken;
  const queryToken = c.req.query("token") || null;
  const isQueryParamToken = !!queryToken;

  if (!token) {
    token = queryToken;
  }

  if (!token) {
    return c.json({ error: "Unauthorized - No token provided" }, 401);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ error: "Unauthorized - Invalid token" }, 401);
  }

  const isUploadRoute = c.req.path.startsWith("/api/upload");

  // Upload-purpose tokens are scoped to upload endpoints regardless of how they
  // are presented (query param OR Authorization header). Without this, an
  // upload token sent as `Authorization: Bearer` would bypass the scope check
  // and act as a full API credential on every /api/* route.
  if (payload.purpose === "upload" && !isUploadRoute) {
    return c.json(
      {
        error:
          "Unauthorized - Upload tokens can only be used for upload endpoints",
      },
      401,
    );
  }

  // General tokens must never travel in the URL (they leak into history,
  // Referer, and proxy logs). Only upload tokens may use the query param.
  if (isQueryParamToken && payload.purpose !== "upload") {
    return c.json(
      {
        error:
          "Unauthorized - General tokens cannot be passed via query parameter",
      },
      401,
    );
  }

  c.set("user", {
    userId: payload.id,
    userRole: payload.userRole,
  });
  c.set("authMethod", "session");

  await next();
};
