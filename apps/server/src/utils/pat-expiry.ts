const DAY_MS = 24 * 60 * 60 * 1000;

export const PAT_DEFAULT_LIFETIME_DAYS = 90;
export const PAT_MAX_LIFETIME_DAYS = 365;

/**
 * Slack on the maximum so a client whose "1 year" lands a day past 365 days
 * (leap years, clock skew) is not rejected.
 */
const MAX_LIFETIME_GRACE_MS = DAY_MS;

export type PatExpiryResult =
  | { ok: true; expiresAt: Date }
  | { ok: false; error: string };

/**
 * Resolve the expiry of a new personal access token. Omitted → the default
 * lifetime; otherwise it must be a valid future date within the maximum
 * lifetime. New tokens always expire (legacy null rows stay valid).
 */
export const resolvePatExpiry = (
  requested: unknown,
  now: Date = new Date(),
): PatExpiryResult => {
  if (requested === undefined || requested === null || requested === "") {
    return {
      ok: true,
      expiresAt: new Date(now.getTime() + PAT_DEFAULT_LIFETIME_DAYS * DAY_MS),
    };
  }

  if (typeof requested !== "string") {
    return { ok: false, error: "expiresAt must be an ISO date string" };
  }

  const parsed = new Date(requested);
  if (Number.isNaN(parsed.getTime()) || parsed <= now) {
    return { ok: false, error: "expiresAt must be a valid future date" };
  }

  const max = now.getTime() + PAT_MAX_LIFETIME_DAYS * DAY_MS;
  if (parsed.getTime() > max + MAX_LIFETIME_GRACE_MS) {
    return {
      ok: false,
      error: `expiresAt must be at most ${PAT_MAX_LIFETIME_DAYS} days from now`,
    };
  }

  return { ok: true, expiresAt: parsed };
};
