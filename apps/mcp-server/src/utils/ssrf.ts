/**
 * SSRF protection for server-side fetches of caller-supplied URLs.
 *
 * Host classification lives in `@wildfires-org/turboplan-utils/ssrf` — the
 * single source of truth shared with the Hono server, the research agent and
 * the map proxy. This module only adds the Workers-flavoured fetch wrapper:
 * manual redirect following so every hop is re-validated, one overall deadline
 * across all hops, and structured logging of failures.
 *
 * DNS REBINDING (F6/F10) — KNOWN LIMITATION, NOT FIXABLE HERE.
 * Cloudflare Workers expose no DNS resolver API and no way to pin a connection
 * to an already-resolved address, so a public hostname whose DNS answer points
 * at a private address cannot be detected before `fetch` connects. The
 * hostname checks below are therefore defense-in-depth; the real backstop is
 * Cloudflare's egress network, which cannot route to RFC1918 space or to link-
 * local metadata endpoints from a Worker in the first place. Runtimes that can
 * resolve DNS (Node/Bun) must additionally check resolved addresses with
 * `isPrivateIpAddress` from the shared module.
 */

import {
  assertSafeFetchUrl,
  type SafeFetchUrlOptions,
} from "@wildfires-org/turboplan-utils/ssrf";

export { assertSafeFetchUrl };
export type { SafeFetchUrlOptions };

export type GuardedFetchResult =
  | { response: Response }
  | { response?: undefined; error: string };

type GuardFailureClass =
  | "ssrf-blocked"
  | "invalid-url"
  | "invalid-redirect"
  | "too-many-redirects"
  | "deadline-exceeded"
  | "fetch-failed";

/**
 * Log a guarded-fetch failure with enough structure to debug an outage without
 * leaking anything back to the caller — the caller-facing message stays the
 * generic string returned by `fetchWithSsrfGuard`.
 */
const logGuardFailure = (details: {
  failure: GuardFailureClass;
  host: string;
  hop: number;
  reason?: string;
}): void => {
  const payload = JSON.stringify({
    event: "ssrf_guarded_fetch_failed",
    ...details,
  });

  if (details.failure === "ssrf-blocked") {
    console.warn(payload);
    return;
  }
  console.error(payload);
};

/**
 * Fetch a caller-supplied URL with per-hop SSRF re-validation and manual
 * redirect handling. Returns the final (non-redirect) Response on success; the
 * caller is responsible for content-type/size validation and reading the body.
 *
 * `timeoutMs` is an overall budget for the whole redirect chain, not a per-hop
 * timeout — a chain of `maxRedirects` slow hops used to be able to hold the
 * isolate for `timeoutMs * (maxRedirects + 1)`.
 */
export const fetchWithSsrfGuard = async (
  initialUrl: string,
  opts: SafeFetchUrlOptions & {
    maxRedirects?: number;
    timeoutMs?: number;
    headers?: Record<string, string>;
    /**
     * Caller-facing message for DNS/connection/timeout failures. Deliberately
     * says nothing about the cause — the detail goes to the structured log.
     */
    fetchFailureMessage?: string;
  } = {},
): Promise<GuardedFetchResult> => {
  const {
    maxRedirects = 3,
    timeoutMs = 30000,
    headers,
    fetchFailureMessage = "Failed to fetch from URL.",
    ...guardOpts
  } = opts;

  let currentUrl: URL;
  try {
    currentUrl = new URL(initialUrl);
  } catch {
    logGuardFailure({ failure: "invalid-url", host: "<unparseable>", hop: 0 });
    return { error: "URL is invalid." };
  }

  const deadline = Date.now() + timeoutMs;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const host = currentUrl.hostname;

    const guardError = assertSafeFetchUrl(currentUrl, guardOpts);
    if (guardError) {
      logGuardFailure({
        failure: "ssrf-blocked",
        host,
        hop,
        reason: guardError,
      });
      return { error: guardError };
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      logGuardFailure({ failure: "deadline-exceeded", host, hop });
      return { error: fetchFailureMessage };
    }

    let hopResponse: Response;
    try {
      hopResponse = await fetch(currentUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(remainingMs),
        ...(headers ? { headers } : {}),
      });
    } catch (error) {
      const timedOut = Date.now() >= deadline;
      logGuardFailure({
        failure: timedOut ? "deadline-exceeded" : "fetch-failed",
        host,
        hop,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return { error: fetchFailureMessage };
    }

    // Follow redirects manually so each hop is re-validated by the guard.
    if (
      hopResponse.status >= 300 &&
      hopResponse.status < 400 &&
      hopResponse.headers.has("location")
    ) {
      // The redirect body is never read; cancel it so the socket is not held.
      await hopResponse.body?.cancel().catch(() => {});

      if (hop === maxRedirects) {
        logGuardFailure({ failure: "too-many-redirects", host, hop });
        return { error: "URL exceeded the maximum number of redirects." };
      }
      try {
        currentUrl = new URL(
          hopResponse.headers.get("location") ?? "",
          currentUrl,
        );
      } catch {
        logGuardFailure({ failure: "invalid-redirect", host, hop });
        return { error: "URL redirect target is invalid." };
      }
      continue;
    }

    return { response: hopResponse };
  }

  logGuardFailure({
    failure: "too-many-redirects",
    host: currentUrl.hostname,
    hop: maxRedirects,
  });
  return { error: fetchFailureMessage };
};
