/**
 * SSRF-guarded fetch for untrusted (LLM-supplied) document URLs. Used by both
 * the content-type probe and the document download.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  isPrivateHost,
  isPrivateIpAddress,
} from "@wildfires-org/turboplan-utils/ssrf";

const DEFAULT_MAX_REDIRECTS = 3;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "host.docker.internal",
  "gateway.docker.internal",
  "kubernetes",
  "kubernetes.default",
  "kubernetes.default.svc",
]);
const BLOCKED_HOSTNAME_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".lan",
  ".home",
  ".corp",
];

const isBlockedHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) =>
    normalized.endsWith(suffix),
  );
};

/**
 * Origin only: query strings of signed/share links can carry credentials, so
 * they never go to logs.
 */
export const describeUrlForLog = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return "<invalid url>";
  }
};

export const isSafeExternalUrl = async (rawUrl: string): Promise<boolean> => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  if (parsed.username !== "" || parsed.password !== "") {
    return false;
  }

  // The shared classifier covers IP literals (incl. IPv4-mapped, NAT64 and
  // 6to4 IPv6 forms); the local list adds internal-looking hostnames.
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || isBlockedHostname(hostname) || isPrivateHost(hostname)) {
    return false;
  }

  if (isIP(hostname.replace(/^\[|\]$/g, "")) !== 0) {
    return true;
  }

  try {
    const resolved = await dnsLookup(hostname, { all: true, verbatim: true });
    if (resolved.length === 0) {
      return false;
    }
    return resolved.every((entry) => !isPrivateIpAddress(entry.address));
  } catch {
    return false;
  }
};

export type SafeFetchOptions = {
  logPrefix: string;
  /** Deadline for the whole exchange: every hop plus reading the body. */
  timeoutMs: number;
  method?: "GET" | "HEAD";
  headers?: Record<string, string>;
  maxRedirects?: number;
};

const isRedirectStatus = (status: number): boolean =>
  status >= 300 && status < 400;

/**
 * Fetch an untrusted URL, validating it and every redirect hop against the
 * SSRF guard. Redirects are followed manually up to `maxRedirects`. Returns
 * null (after logging) when a hop is unsafe or the redirect chain is invalid
 * or too long; network errors and timeouts are thrown to the caller.
 */
export const safeFetch = async (
  rawUrl: string,
  options: SafeFetchOptions,
): Promise<Response | null> => {
  const {
    logPrefix,
    timeoutMs,
    method = "GET",
    headers,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
  } = options;
  const signal = AbortSignal.timeout(timeoutMs);

  let currentUrl = rawUrl;
  for (let redirects = 0; ; redirects += 1) {
    if (!(await isSafeExternalUrl(currentUrl))) {
      console.warn(
        `[${logPrefix}] Blocking unsafe URL ${describeUrlForLog(currentUrl)}`,
      );
      return null;
    }

    const response = await fetch(currentUrl, {
      method,
      headers,
      redirect: "manual",
      signal,
    });
    if (!isRedirectStatus(response.status)) {
      return response;
    }
    await response.body?.cancel();

    if (redirects >= maxRedirects) {
      console.warn(
        `[${logPrefix}] Too many redirects from ${describeUrlForLog(rawUrl)}`,
      );
      return null;
    }

    const location = response.headers.get("location");
    if (!location) {
      console.warn(
        `[${logPrefix}] Redirect without location from ${describeUrlForLog(currentUrl)}`,
      );
      return null;
    }
    try {
      currentUrl = new URL(location, currentUrl).toString();
    } catch {
      console.warn(
        `[${logPrefix}] Invalid redirect location from ${describeUrlForLog(currentUrl)}`,
      );
      return null;
    }
  }
};
