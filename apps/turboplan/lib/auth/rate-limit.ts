import { headers } from "next/headers";

import {
  createRateLimiter,
  extractClientIp,
} from "@wildfires-org/turboplan-utils/server";

/**
 * Rate limiting for the auth server actions (magic-link requests,
 * verification). Uses the shared in-memory limiter
 * (`@wildfires-org/turboplan-utils/server`), so it is per-isolate: on a
 * serverless deploy the effective ceiling is `limit x isolates` and it resets
 * on cold start. That is acceptable here — the goal is to blunt email bombing
 * and unbounded account creation, which previously had NO limit at all. A
 * shared store (see M-12) would make it hard.
 */

const MINUTE = 60 * 1000;

const checkRequestIpLimit = createRateLimiter({
  windowMs: 10 * MINUTE,
  maxRequests: 10,
});
const checkRequestEmailLimit = createRateLimiter({
  windowMs: 10 * MINUTE,
  maxRequests: 5,
});
const checkVerifyIpLimit = createRateLimiter({
  windowMs: 5 * MINUTE,
  maxRequests: 30,
});

/**
 * Best-effort client IP for rate-limit bucketing. `headers()` exposes no `cf`
 * object, so the decision to trust `cf-connecting-ip` is made from
 * `WORKER_RUNTIME` — see the shared `extractClientIp`.
 */
const getClientIp = async (): Promise<string> => {
  const h = await headers();
  return extractClientIp((name) => h.get(name));
};

/**
 * Gate a magic-link request (register/login). Limited BOTH per-IP (an attacker
 * can't fan out sends) and per-email (a victim can't be bombed from many IPs).
 * Returns true if allowed, false if the caller should be throttled.
 */
export const checkMagicLinkRequestLimit = async (
  email: string,
): Promise<boolean> => {
  const ip = await getClientIp();
  if (!checkRequestIpLimit(ip)) {
    return false;
  }
  return checkRequestEmailLimit(email);
};

/**
 * Gate a magic-link verification attempt (per-IP). Tokens are 256-bit so this
 * is defense-in-depth against automated abuse, not the primary control.
 */
export const checkMagicLinkVerifyLimit = async (): Promise<boolean> => {
  const ip = await getClientIp();
  return checkVerifyIpLimit(ip);
};
