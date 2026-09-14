/**
 * Shared in-memory fixed-window rate limiting.
 *
 * Framework-agnostic: the limiter keys off an arbitrary string and the IP
 * extractor takes a header getter, so Hono, Next.js `headers()` and plain
 * fetch handlers all reuse the same implementation via thin adapters.
 */

import { isWorkerRuntime } from "@wildfires-org/turboplan-env";

// Hard ceiling on tracked buckets. Reached only under a distributed flood; the
// limiter degrades (evicting the oldest buckets, which are the closest to
// expiry) instead of growing the isolate's heap without bound.
const MAX_BUCKETS = 10_000;

// How many calls may pass between inline sweeps. No timer on purpose:
// module-scope setInterval crashes Cloudflare Workers ("Disallowed operation
// called within global scope") and a request-scoped one never fires after the
// request ends — so a sweeper interval either kills the Worker or silently
// does nothing, depending on where the module loads.
const SWEEP_EVERY_CALLS = 256;

type Bucket = { count: number; resetTime: number };

export type RateLimiter = ((key: string) => boolean) & {
  /** Bucket count, exposed so tests can observe eviction. */
  size: () => number;
};

/**
 * Simple in-memory fixed-window limiter, keyed by an arbitrary identifier.
 *
 * Per-isolate (not shared across replicas) — on a serverless deploy the
 * effective ceiling is `maxRequests x isolates` and it resets on cold start.
 * For hard guarantees use a shared store. Bucket state is single-threaded
 * within one Node/Bun/Worker isolate, so the read-modify-write inside each
 * call is race-free per identifier.
 *
 * Each caller creates its own bucket map, so limits are per-limiter, never
 * shared between endpoints.
 */
export const createRateLimiter = ({
  windowMs,
  maxRequests,
}: {
  windowMs: number;
  maxRequests: number;
}): RateLimiter => {
  const buckets = new Map<string, Bucket>();
  let callsSinceSweep = 0;

  const sweep = (now: number): void => {
    for (const [key, record] of buckets.entries()) {
      if (record.resetTime < now) {
        buckets.delete(key);
      }
    }

    if (buckets.size <= MAX_BUCKETS) {
      return;
    }

    // Still over cap after dropping expired entries: evict the oldest buckets.
    // A Map iterates in insertion order and buckets are only ever inserted
    // (never re-inserted — an in-window hit mutates `count` in place), so the
    // front of the map is the least recently created entry, which for a fixed
    // window is also the one closest to expiry. Walking the front is O(excess);
    // sorting the whole map would be O(n log n) on EVERY call once over cap,
    // turning a flood into a CPU amplifier.
    let excess = buckets.size - MAX_BUCKETS;
    for (const key of buckets.keys()) {
      if (excess <= 0) {
        break;
      }
      buckets.delete(key);
      excess -= 1;
    }
  };

  const isAllowed = (key: string): boolean => {
    const now = Date.now();

    // Sweep every N calls OR whenever the map is over cap. Amortizing on call
    // count (rather than once per window) bounds memory even when a flood of
    // distinct keys arrives inside a single window.
    callsSinceSweep += 1;
    if (callsSinceSweep >= SWEEP_EVERY_CALLS || buckets.size > MAX_BUCKETS) {
      callsSinceSweep = 0;
      sweep(now);
    }

    const record = buckets.get(key);

    if (!record || now > record.resetTime) {
      // `Map.set` on an existing key keeps its original position, so a renewed
      // bucket must be deleted first to move to the back. The over-cap eviction
      // walks insertion order and would otherwise drop a freshly renewed key.
      buckets.delete(key);
      buckets.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    if (record.count >= maxRequests) {
      return false;
    }
    record.count += 1;
    return true;
  };

  return Object.assign(isAllowed, { size: () => buckets.size });
};

/**
 * Best-effort client IP for rate-limit bucketing.
 *
 * `cf-connecting-ip` is written by Cloudflare's edge and cannot be spoofed —
 * but only for requests that actually traversed Cloudflare. Anywhere else
 * (local dev, Vercel, a direct origin hit) it is just another client-supplied
 * header, so honouring it would let an attacker rotate it and mint a fresh
 * bucket per request, defeating the limiter entirely. Trust it only when
 * `WORKER_RUNTIME` marks this process as a Cloudflare Worker; otherwise fall
 * back to the first `x-forwarded-for` entry, which the hosting proxy rewrites
 * from the socket address.
 *
 * @param getHeader case-insensitive header lookup (`c.req.header`,
 *   `(await headers()).get`, `request.headers.get`, ...).
 */
export const extractClientIp = (
  getHeader: (name: string) => string | null | undefined,
): string => {
  const forwarded = () =>
    getHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    getHeader("x-real-ip") ||
    "unknown";

  if (isWorkerRuntime()) {
    return getHeader("cf-connecting-ip") || forwarded();
  }
  return forwarded();
};
