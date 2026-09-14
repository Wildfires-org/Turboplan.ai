import { lookup } from "node:dns/promises";

import { isLocalDevelopment } from "@wildfires-org/turboplan-env";
import {
  classifyHost,
  isPrivateIpAddress,
} from "@wildfires-org/turboplan-utils/ssrf";

import { logger } from "../../infra/logger";

/**
 * Post-resolution SSRF check (F6/F10).
 *
 * The schema guard in `../validation` only sees the hostname, so an attacker
 * who controls DNS for a public-looking name can point it at 10.0.0.0/8 or at
 * 169.254.169.254 and sail through. This resolves the name and rejects it when
 * ANY returned address is internal.
 *
 * TOCTOU CAVEAT: this is a check, not a pin. Node's `fetch` resolves the name
 * again when it connects, so a DNS answer with a very short TTL can still flip
 * between this lookup and the socket. Closing that fully needs a custom agent
 * that dials the already-validated address (undici `connect` hook), which the
 * runtime here does not currently wire up. Rejecting the obvious case still
 * removes the whole "point a public name at metadata" class; the residual risk
 * is a narrow race that also has to beat resolver caching.
 */

/** How long a resolution may take before the target is rejected. */
const LOOKUP_TIMEOUT_MS = 5_000;

const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("dns lookup timed out")),
          LOOKUP_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

/**
 * Resolve `rawUrl`'s hostname and reject it when any resolved address is
 * private, loopback, or otherwise internal. Returns an error message on
 * rejection, or null when the target is acceptable.
 *
 * Hosts that are already IP literals are classified directly — there is
 * nothing to resolve. Loopback follows the same dev-only allowance as the
 * schema guard so `pnpm dev` against a local API keeps working.
 */
export const assertPublicTarget = async (
  rawUrl: string,
): Promise<string | null> => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "targetApiUrl is not a valid URL";
  }

  const allowLoopback = isLocalDevelopment();
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const classification = classifyHost(url.hostname);

  // IP literals and known-internal names never reach the resolver.
  if (classification !== "public") {
    if (classification === "loopback" && allowLoopback) {
      return null;
    }
    return "targetApiUrl must not point to a private network";
  }

  let addresses: { address: string }[];
  try {
    addresses = await withTimeout(lookup(hostname, { all: true }));
  } catch (error) {
    logger.log(
      `dns lookup failed for ${hostname}: ${
        error instanceof Error ? error.message : "unknown"
      }`,
      "target-api",
    );
    return "targetApiUrl could not be resolved";
  }

  if (addresses.length === 0) {
    return "targetApiUrl could not be resolved";
  }

  for (const { address } of addresses) {
    if (!isPrivateIpAddress(address)) {
      continue;
    }
    if (classifyHost(address) === "loopback" && allowLoopback) {
      continue;
    }
    logger.log(
      `rejected targetApiUrl ${hostname}: resolves to internal address`,
      "security",
    );
    return "targetApiUrl must not point to a private network";
  }

  return null;
};
