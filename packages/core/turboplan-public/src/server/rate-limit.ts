/**
 * Rate limiting helpers for public (unauthenticated) routers.
 *
 * The limiter itself is the shared implementation from
 * `@wildfires-org/turboplan-utils/server`; this module only adds the Hono
 * adapter for header-based IP extraction.
 */

import type { Context } from "hono";

import { extractClientIp as extractClientIpFromHeaders } from "@wildfires-org/turboplan-utils/server";

export { createRateLimiter } from "@wildfires-org/turboplan-utils/server";

/**
 * Best-effort client IP for rate-limit bucketing, read from the Hono request.
 * See the shared `extractClientIp` for why `cf-connecting-ip` is trusted only
 * when `WORKER_RUNTIME` marks this process as a Cloudflare Worker.
 */
export const extractClientIp = (c: Context): string =>
  extractClientIpFromHeaders((name) => c.req.header(name));
