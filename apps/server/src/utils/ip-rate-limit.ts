import type { Context } from "hono";

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
