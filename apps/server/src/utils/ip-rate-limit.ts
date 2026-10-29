import type { Context, MiddlewareHandler } from "hono";

import {
  createRateLimiter,
  extractClientIp,
} from "@wildfires-org/turboplan-utils/server";

/**
 * Hono adapter over the shared in-memory limiter
 * (`@wildfires-org/turboplan-utils/server`). Each caller creates its own
 * bucket map, so limits are per-endpoint, not shared. Per-isolate — for hard
 * guarantees use a shared store.
 */

/**
 * Best-effort client IP for rate-limit bucketing, read from the Hono request.
 * See `extractClientIp` for why `cf-connecting-ip` is only trusted on Workers.
 */
export const extractClientIP = (c: Context): string =>
  extractClientIp((name) => c.req.header(name));

export const createIpRateLimiter = ({
  windowMs,
  maxRequests,
}: {
  windowMs: number;
  maxRequests: number;
}) => {
  const limiter = createRateLimiter({ windowMs, maxRequests });

  const isAllowed = (c: Context): boolean => limiter(extractClientIP(c));

  // Bucket count, exposed so tests can observe eviction.
  return Object.assign(isAllowed, { size: limiter.size });
};

/**
 * The subset of a Cloudflare rate-limiting binding (`ratelimits` in
 * `wrangler.jsonc`) this server uses.
 */
type RateLimitBinding = {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
};

// `c.env` is the Worker env on Cloudflare (worker.ts passes it through), the
// Bun server or Node socket pair locally, and undefined in `app.request` tests,
// so the binding is duck-typed rather than assumed.
const getRateLimitBinding = (
  c: Context,
  name: string,
): RateLimitBinding | null => {
  const binding = (c.env as Record<string, unknown> | undefined)?.[name];
  return typeof (binding as RateLimitBinding | undefined)?.limit === "function"
    ? (binding as RateLimitBinding)
    : null;
};

/**
 * Per-IP limit answering 429 once exceeded. On Workers it counts through the
 * named rate-limiting binding, which is shared across isolates and survives
 * cold starts (per Cloudflare location). Wherever the binding is absent (local
 * dev, tests) it falls back to the in-memory limiter with the same window, so
 * `windowMs` / `maxRequests` must match the binding's `simple` config.
 */
export const createIpRateLimitMiddleware = ({
  binding,
  windowMs,
  maxRequests,
}: {
  binding: string;
  windowMs: number;
  maxRequests: number;
}): MiddlewareHandler => {
  const isAllowedInMemory = createIpRateLimiter({ windowMs, maxRequests });

  // A binding that errors must not turn the endpoint into a 500, nor drop the
  // limit: count that request in memory instead.
  const isAllowedByBinding = async (
    c: Context,
    limiter: RateLimitBinding,
  ): Promise<boolean> => {
    try {
      const { success } = await limiter.limit({ key: extractClientIP(c) });
      return success;
    } catch (error) {
      console.error(
        `Rate limit binding ${binding} failed; using the in-memory limit:`,
        error,
      );
      return isAllowedInMemory(c);
    }
  };

  return async (c, next) => {
    const limiter = getRateLimitBinding(c, binding);
    const isAllowed = limiter
      ? await isAllowedByBinding(c, limiter)
      : isAllowedInMemory(c);

    if (!isAllowed) {
      return c.json(
        { error: "Rate limit exceeded. Please try again later." },
        429,
      );
    }
    await next();
  };
};
