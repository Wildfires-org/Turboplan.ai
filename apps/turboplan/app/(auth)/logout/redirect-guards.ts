/**
 * Pure guards for the logout flow. Kept out of `page.tsx` so they can be
 * unit tested without pulling in Next's server-only `headers()`/env plumbing.
 */

export const SAFE_REDIRECT_FALLBACK = "/login";

const RELATIVE_PROBE_ORIGIN = "http://relative.test";

const TRUSTED_FETCH_SITES = ["same-origin", "same-site", "none"];

const toOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * Only allow redirecting back to a relative path or to the landing page origin.
 * Prevents `/logout?callbackUrl=https://evil.example` open redirects.
 */
export const resolveRedirectTo = (
  callbackUrl: string | undefined,
  landingUrl: string,
): string => {
  if (!callbackUrl) {
    return SAFE_REDIRECT_FALLBACK;
  }

  if (callbackUrl.startsWith("/")) {
    // Resolve against a probe origin so `//evil` and `/\evil` (which browsers
    // normalise to a protocol-relative URL) are rejected, not just `//`.
    const probe = new URL(callbackUrl, RELATIVE_PROBE_ORIGIN);
    return probe.origin === RELATIVE_PROBE_ORIGIN
      ? callbackUrl
      : SAFE_REDIRECT_FALLBACK;
  }

  const landingOrigin = toOrigin(landingUrl);
  const targetOrigin = toOrigin(callbackUrl);

  if (landingOrigin && targetOrigin && landingOrigin === targetOrigin) {
    return callbackUrl;
  }

  return SAFE_REDIRECT_FALLBACK;
};

/**
 * Auto sign-out only for navigations that originate from our own site
 * (landing page shares the cookie domain, so it counts as `same-site`).
 * A cross-site link to /logout would otherwise log the user out without
 * asking — the CSRF the default NextAuth confirmation page guards against.
 *
 * Browsers that omit the header (old Safari/Firefox) get the confirm button.
 */
export const isTrustedFetchSite = (fetchSite: string | null): boolean =>
  fetchSite !== null && TRUSTED_FETCH_SITES.includes(fetchSite);
