import { Hono } from "hono";

import { getApiEnv } from "@wildfires-org/turboplan-env";

import {
  reconcileSubscriptionSeats,
  sweepDiscountEndingNotices,
  sweepUnreportedOverageEvents,
} from "./reconciliation";

/**
 * Constant-time string comparison. After an early length check (a mismatched
 * length is not secret), XOR-accumulates every char code so the loop runs the
 * full length regardless of where the first difference is — no short-circuit,
 * so an attacker cannot learn the secret byte-by-byte from response timing.
 *
 * Kept dependency-free (no `node:crypto`) so it runs unchanged on the Cloudflare
 * Workers runtime, where Node's `crypto.timingSafeEqual` is not available.
 */
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
};

/**
 * Secret-protected manual trigger for a FULL seat-reconciliation scan. Serves
 * two roles: an ops escape hatch, and a pluggable hook for any external
 * scheduler (so reconciliation needs no platform-specific cron). The primary,
 * per-org drift guard is the `invoice.upcoming` webhook — this endpoint is the
 * belt to that suspenders.
 *
 * Auth: the caller must send `x-reconcile-secret` matching `RECONCILE_SECRET`.
 * The endpoint is DISABLED (404) unless the secret is configured, so it never
 * exists in environments that did not opt in. A wrong secret returns 401. Both
 * responses use a uniform body with no hints about why they were rejected.
 *
 * Mounted pre-auth (external schedulers carry no session) at
 * `/api/billing/reconcile`; see apps/server publicRoutes.ts.
 */
export const reconcileRouter = new Hono();

reconcileRouter.post("/", async (c) => {
  const expected = getApiEnv().RECONCILE_SECRET;

  // Not configured → the endpoint does not exist. 404 (not 403) so its presence
  // is not revealed in environments that never opted in.
  if (!expected) {
    return c.json({ error: "Not found" }, 404);
  }

  const provided = c.req.header("x-reconcile-secret") ?? "";
  if (!timingSafeEqual(provided, expected)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Overage first: it is the money-critical sweep, and a timeout on the
  // full seat scan must not starve it.
  const overage = await sweepUnreportedOverageEvents();
  const seats = await reconcileSubscriptionSeats();
  const discountNotices = await sweepDiscountEndingNotices();
  return c.json({ seats, overage, discountNotices });
});
