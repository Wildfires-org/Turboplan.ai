import type { Context, MiddlewareHandler, Next } from "hono";

import { timingSafeCompare } from "@wildfires-org/turboplan-auth/secrets";
import { getApiEnv } from "@wildfires-org/turboplan-env";

/** Middleware that authenticates requests via X-API-Key header. */
export const apiKeyMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  if (c.req.method === "OPTIONS") {
    return next();
  }

  const providedKey = c.req.header("x-api-key");

  if (!providedKey) {
    return c.json({ error: "Unauthorized - Missing x-api-key header" }, 401);
  }

  const env = getApiEnv();
  if (!timingSafeCompare(providedKey, env.SERVER_API_KEY)) {
    return c.json({ error: "Unauthorized - Invalid API key" }, 401);
  }

  await next();
};
