/**
 * Shared SSRF host classifier.
 *
 * Single source of truth for "is this fetch target internal?" across every
 * runtime in the monorepo (Cloudflare Workers, Bun/Node Hono servers, Next.js
 * route handlers). This file is deliberately pure string/number logic — no
 * `node:*` imports, no `process.env`, no DNS — so it can be bundled into a
 * Worker isolate unchanged. Runtime-specific concerns (DNS pinning, fetch
 * wrappers, dev-mode toggles) live at the call sites and feed in through
 * options.
 *
 * The rule set is the UNION of the strictest checks that previously lived in
 * four hand-copied variants: RFC1918, loopback, CGNAT, link-local/metadata,
 * benchmarking, multicast + reserved, IPv6 ULA/link-local/multicast, and every
 * IPv6 transition format that can smuggle an IPv4 address (IPv4-mapped,
 * IPv4-compatible, NAT64, 6to4).
 */

/**
 * How a hostname should be treated by an SSRF guard.
 *
 * `loopback` is split out from `private` so callers can allow it in local
 * development (where the target legitimately is the dev machine) while every
 * deployed environment keeps rejecting it.
 */
export type HostClassification = "public" | "loopback" | "private" | "invalid";

/**
 * Hostname suffixes that resolve inside private networks. Fly 6PN uses
 * `.internal`, mDNS uses `.local`. `.localhost` is handled separately because
 * it classifies as loopback rather than generic private.
 */
const PRIVATE_HOST_SUFFIXES = [".internal", ".local"];

/**
 * Parse a strict dotted-quad IPv4 string into a 32-bit number, or null when it
 * is not a well-formed dotted quad.
 *
 * Short ("127.1"), decimal ("2130706433"), octal ("0177.0.0.1") and hex
 * ("0x7f000001") forms deliberately fail here: the WHATWG URL parser already
 * canonicalises them to dotted quads in `URL.hostname`, so anything still in
 * one of those shapes did not come through a URL parser and must be treated as
 * hostile rather than guessed at. `classifyHost` maps that failure to
 * `"invalid"` (blocked), never to `"public"`.
 */
const parseIpv4 = (host: string): number | null => {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    value = value * 256 + octet;
  }
  return value >>> 0;
};

const inIpv4Range = (ip: number, base: string, prefix: number): boolean => {
  const baseIp = parseIpv4(base);
  if (baseIp === null) {
    return false;
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ip & mask) === (baseIp & mask);
};

/** Classify a 32-bit IPv4 address. */
const classifyIpv4 = (ip: number): HostClassification => {
  // 0.0.0.0/8 ("this network") reaches the local host on most stacks, so it
  // belongs with loopback rather than with generic private ranges.
  if (inIpv4Range(ip, "0.0.0.0", 8) || inIpv4Range(ip, "127.0.0.0", 8)) {
    return "loopback";
  }

  const isPrivate =
    inIpv4Range(ip, "10.0.0.0", 8) || // RFC1918
    inIpv4Range(ip, "100.64.0.0", 10) || // CGNAT (Fly, GCP, k8s overlays)
    inIpv4Range(ip, "169.254.0.0", 16) || // link-local incl. 169.254.169.254 metadata
    inIpv4Range(ip, "172.16.0.0", 12) || // RFC1918
    inIpv4Range(ip, "192.0.0.0", 24) || // IETF protocol assignments
    inIpv4Range(ip, "192.0.2.0", 24) || // TEST-NET-1
    inIpv4Range(ip, "192.168.0.0", 16) || // RFC1918
    inIpv4Range(ip, "198.18.0.0", 15) || // benchmarking
    inIpv4Range(ip, "198.51.100.0", 24) || // TEST-NET-2
    inIpv4Range(ip, "203.0.113.0", 24) || // TEST-NET-3
    inIpv4Range(ip, "224.0.0.0", 3); // multicast 224/4 + reserved 240/4 + broadcast

  return isPrivate ? "private" : "public";
};

/**
 * Expand an IPv6 literal (already stripped of surrounding brackets) into eight
 * 16-bit groups, handling "::" compression and a trailing embedded IPv4 tail
 * ("::ffff:10.0.0.1"). Returns null when the literal is malformed.
 */
const parseIpv6 = (input: string): number[] | null => {
  let str = input;

  // Rewrite a trailing dotted-quad tail ("::ffff:10.0.0.1") into the two hex
  // groups it stands for, so the rest of the parser only ever sees hex groups.
  if (str.includes(".")) {
    const lastColonIdx = str.lastIndexOf(":");
    if (lastColonIdx === -1) {
      return null;
    }
    const v4 = parseIpv4(str.slice(lastColonIdx + 1));
    if (v4 === null) {
      return null;
    }
    const high = ((v4 >>> 16) & 0xffff).toString(16);
    const low = (v4 & 0xffff).toString(16);
    str = `${str.slice(0, lastColonIdx + 1)}${high}:${low}`;
  }

  if ((str.match(/::/g)?.length ?? 0) > 1) {
    return null;
  }

  const toGroups = (segment: string): number[] | null => {
    if (segment === "") {
      return [];
    }
    const out: number[] = [];
    for (const part of segment.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(part)) {
        return null;
      }
      out.push(Number.parseInt(part, 16));
    }
    return out;
  };

  let groups: number[];
  if (str.includes("::")) {
    const [headPart = "", tailPart = ""] = str.split("::");
    const head = toGroups(headPart);
    const tail = toGroups(tailPart);
    if (head === null || tail === null) {
      return null;
    }
    const middleLen = 8 - head.length - tail.length;
    if (middleLen < 0) {
      return null;
    }
    groups = [...head, ...new Array<number>(middleLen).fill(0), ...tail];
  } else {
    const head = toGroups(str);
    if (head === null) {
      return null;
    }
    groups = head;
  }

  return groups.length === 8 ? groups : null;
};

const v4FromGroups = (high: number, low: number): number =>
  ((high << 16) | low) >>> 0;

/** Classify an IPv6 address given as eight 16-bit groups. */
const classifyIpv6 = (groups: number[]): HostClassification => {
  const leadingZeros = (count: number): boolean =>
    groups.slice(0, count).every((group) => group === 0);

  // Unspecified (::) and loopback (::1).
  if (leadingZeros(7) && groups[7] <= 1) {
    return "loopback";
  }

  // IPv4-mapped ::ffff:a.b.c.d AND IPv4-compatible ::a.b.c.d. The latter is
  // the shape that bypassed the old guards: WHATWG canonicalises
  // "[::10.0.0.1]" to "[::a00:1]", which has groups[5] === 0, so a check that
  // only looked for the 0xffff marker let it through as public.
  if (leadingZeros(5) && (groups[5] === 0xffff || groups[5] === 0)) {
    return classifyIpv4(v4FromGroups(groups[6], groups[7]));
  }

  // NAT64 well-known prefix 64:ff9b::/96 — the embedded v4 is the real target.
  if (
    groups[0] === 0x64 &&
    groups[1] === 0xff9b &&
    groups.slice(2, 6).every((group) => group === 0)
  ) {
    return classifyIpv4(v4FromGroups(groups[6], groups[7]));
  }

  // 6to4 2002::/16 embeds the v4 address in groups 1-2.
  if (groups[0] === 0x2002) {
    const embedded = classifyIpv4(v4FromGroups(groups[1], groups[2]));
    if (embedded !== "public") {
      return embedded;
    }
  }

  const isPrivate =
    ((groups[0] >> 8) & 0xfe) === 0xfc || // fc00::/7 unique local
    (groups[0] & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (groups[0] & 0xff00) === 0xff00; // ff00::/8 multicast

  return isPrivate ? "private" : "public";
};

/**
 * Classify a hostname exactly as `URL.hostname` reports it: lowercase, no
 * port, IPv6 literals wrapped in brackets. Bare (unbracketed) IPv6 strings are
 * also accepted so DNS resolver output can be classified with the same rules.
 *
 * Anything unrecognisable classifies as `"invalid"`, which callers must treat
 * as blocked — never as public.
 */
export const classifyHost = (rawHostname: string): HostClassification => {
  const hostname = rawHostname.trim().toLowerCase().replace(/\.+$/, "");
  if (hostname === "") {
    return "invalid";
  }

  if (hostname.startsWith("[")) {
    if (!hostname.endsWith("]")) {
      return "invalid";
    }
    const groups = parseIpv6(hostname.slice(1, -1));
    return groups === null ? "invalid" : classifyIpv6(groups);
  }

  // A colon in a parsed hostname can only be an unbracketed IPv6 literal;
  // named hosts never contain one.
  if (hostname.includes(":")) {
    const groups = parseIpv6(hostname);
    return groups === null ? "invalid" : classifyIpv6(groups);
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return "loopback";
  }

  if (PRIVATE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return "private";
  }

  // WHATWG treats a host whose last label is numeric as an IPv4 address. Match
  // that rule: such a host must parse as a strict dotted quad or it is
  // invalid — otherwise "0177.0.0.1" or "2130706433" would fall through to
  // "public" when the classifier is handed a hostname that never went through
  // a URL parser.
  const labels = hostname.split(".");
  const lastLabel = labels[labels.length - 1];
  if (/^\d+$/.test(lastLabel) || /^0x[0-9a-f]*$/.test(lastLabel)) {
    const ipv4 = parseIpv4(hostname);
    return ipv4 === null ? "invalid" : classifyIpv4(ipv4);
  }

  return "public";
};

/**
 * True when `hostname` must not be fetched server-side. Loopback counts as
 * private here; use `classifyHost` directly when loopback needs its own
 * treatment.
 */
export const isPrivateHost = (hostname: string): boolean =>
  classifyHost(hostname) !== "public";

/**
 * True when a bare IP address string (as produced by a DNS resolver, IPv6
 * unbracketed) points somewhere internal. Used for post-resolution checks that
 * close the DNS-rebinding gap hostname checks cannot see.
 */
export const isPrivateIpAddress = (address: string): boolean =>
  classifyHost(address) !== "public";

export type SafeFetchUrlOptions = {
  /** Allow plain `http:` to any allowed host. Defaults to false (https only). */
  allowHttp?: boolean;
  /**
   * Allow loopback targets (localhost, 127.0.0.0/8, ::1) and plain http to
   * them. Gate this on a local-development check — never leave it on in a
   * deployed environment.
   */
  allowLoopback?: boolean;
  /** Noun used in the returned messages. Defaults to "URL". */
  label?: string;
};

/**
 * SSRF guard for a fetch target. Returns a caller-safe error message when the
 * URL must be rejected, or null when it is acceptable to fetch.
 *
 * Loopback is rejected regardless of scheme unless `allowLoopback` is set —
 * `https://127.0.0.1` and `https://[::1]` are exactly as dangerous as their
 * http equivalents.
 *
 * This is a hostname-level check. It cannot see DNS rebinding: a public name
 * that resolves to a private address still passes. Runtimes that can resolve
 * DNS should additionally check the resolved addresses with
 * `isPrivateIpAddress`.
 */
export const assertSafeFetchUrl = (
  url: URL,
  opts: SafeFetchUrlOptions = {},
): string | null => {
  const { allowHttp = false, allowLoopback = false, label = "URL" } = opts;

  const classification = classifyHost(url.hostname);
  const isLoopback = classification === "loopback";
  const httpAllowed = allowHttp || (allowLoopback && isLoopback);

  if (url.protocol !== "https:" && !(url.protocol === "http:" && httpAllowed)) {
    return allowHttp
      ? `${label} must use HTTP or HTTPS.`
      : `${label} must use HTTPS.`;
  }

  if (url.username !== "" || url.password !== "") {
    return `${label} must not contain credentials.`;
  }

  if (classification === "invalid") {
    return `${label} has an invalid host.`;
  }

  if (classification === "private" || (isLoopback && !allowLoopback)) {
    return `${label} host is not allowed.`;
  }

  return null;
};
