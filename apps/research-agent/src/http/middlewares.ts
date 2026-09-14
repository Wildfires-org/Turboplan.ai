/**
 * Hono middleware for research-agent-sandbox.
 */

import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

import { timingSafeCompare } from "@wildfires-org/turboplan-auth/secrets";

import { logger } from "../infra/logger";

/**
 * Convert a glob-like pattern to a RegExp.
 * `*` in the pattern matches any sequence of characters.
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexStr = escaped.replace(/\*/g, ".*");
  return new RegExp(`^${regexStr}$`);
}

/**
 * Compile origin patterns into a reusable matcher.
 * Shared by CORS and origin guard middlewares.
 */
function compileOriginMatcher(allowedOrigins: string[]) {
  const allowAll = allowedOrigins.includes("*");
  const compiledPatterns = allowedOrigins
    .filter((p) => p !== "*")
    .map(globToRegex);

  return {
    allowAll,
    isAllowed: (origin: string): boolean => {
      if (allowAll) return true;
      const normalized = origin.replace(/\/+$/, "");
      return compiledPatterns.some((regex) => regex.test(normalized));
    },
  };
}

/**
 * Create origin guard middleware that actively rejects requests from
 * non-allowed origins. Unlike CORS (which only sets headers), this
 * middleware blocks the request server-side before the agent runs.
 */
export function createOriginGuardMiddleware(
  allowedOrigins: string[],
): MiddlewareHandler {
  const { allowAll, isAllowed } = compileOriginMatcher(allowedOrigins);

  return async (c, next) => {
    if (allowAll) return next();

    const origin = c.req.header("Origin");
    if (!origin) return next(); // server-to-server, api key auth handles it

    if (!isAllowed(origin)) {
      logger.log(`Blocked origin: ${origin}`, "security");
      return c.json({ error: "Origin not allowed" }, 403);
    }

    return next();
  };
}

/**
 * Create API key authentication middleware.
 * Validates the x-api-key header against the configured API key.
 */
export function createApiKeyAuthMiddleware(apiKey: string): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method === "OPTIONS") return next();

    const key = c.req.header("x-api-key");

    if (!key) {
      throw new HTTPException(401, { message: "Missing x-api-key header" });
    }

    if (!timingSafeCompare(key, apiKey)) {
      throw new HTTPException(401, { message: "Invalid API key" });
    }

    await next();
  };
}
