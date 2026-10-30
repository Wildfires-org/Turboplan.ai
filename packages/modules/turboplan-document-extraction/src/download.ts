import { MAX_DOCUMENT_BYTES } from "./limits";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Matches a bare IPv4 dotted-quad. The WHATWG URL parser normalizes decimal,
// octal, and hex IPv4 forms (e.g. "2130706433", "0x7f.1") to dotted-quad in
// `hostname`, so testing the parsed hostname against this catches those too.
const IPV4_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/**
 * True when `hostname` (as returned by `URL.hostname`) is a raw IP literal.
 * IPv6 literals are bracketed by the parser (e.g. "[::1]").
 */
const isIpLiteralHostname = (hostname: string): boolean => {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return true;
  }
  // A colon in an already-parsed hostname can only be a (non-bracketed) IPv6
  // literal; named hosts never contain one.
  if (hostname.includes(":")) {
    return true;
  }
  return IPV4_PATTERN.test(hostname);
};

/**
 * SSRF guard for document URLs. Documents are always hosted on named public
 * https domains, so the safe, simple policy is: require https, forbid ANY raw
 * IP literal (which covers loopback 127.0.0.0/8 + ::1, private 10/8, 172.16/12,
 * 192.168/16, link-local/metadata 169.254/16 + fe80::/10, and unspecified
 * 0.0.0.0 + ::), and forbid localhost / internal-only hostnames.
 *
 * NOTE: this does NOT defend against DNS-rebinding — a public hostname that
 * resolves to a private/internal address would still pass here. Closing that
 * gap requires resolve-time (post-DNS) checks against the connected IP.
 */
export const isDisallowedDocumentUrl = (url: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }

  if (parsed.protocol !== "https:") {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return true;
  }

  if (isIpLiteralHostname(hostname)) {
    return true;
  }

  // Single-label hostnames (e.g. "metadata", "kubernetes", "intranet") resolve
  // via internal DNS search domains — public documents always live on
  // fully-qualified domains. Trailing dots are stripped first so "metadata."
  // cannot sneak past.
  if (!hostname.replace(/\.+$/, "").includes(".")) {
    return true;
  }

  return false;
};

export type DownloadResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; reason: "fetch-failed"; message: string; detail?: string };

const GENERIC_FETCH_ERROR = "Could not download the document.";

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Download a document into memory, behind the SSRF guard (https only, no IP
 * literals or internal hosts, every redirect re-checked) and the 50MB cap.
 * Never throws. Every read of a stored document goes through here, so moving
 * storage behind credentials later only changes this function.
 */
export const downloadDocument = async (
  url: string,
  options?: { signal?: AbortSignal },
): Promise<DownloadResult> => {
  const externalSignal = options?.signal;
  // Reject unparseable and SSRF-prone URLs before opening any connection.
  try {
    new URL(url);
  } catch {
    return {
      ok: false,
      reason: "fetch-failed",
      message: "Invalid document URL",
    };
  }
  if (isDisallowedDocumentUrl(url)) {
    return {
      ok: false,
      reason: "fetch-failed",
      message: "Disallowed document URL",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  // The caller's signal (worker threads use one to kill runaway jobs) aborts
  // the same controller, so the 30s timeout still applies on top of it.
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromCaller();
    } else {
      externalSignal.addEventListener("abort", abortFromCaller, {
        once: true,
      });
    }
  }

  try {
    // Follow redirects manually so every hop is re-validated against the SSRF
    // guard — fetch's default "follow" would chase a 302 from an allowed host
    // straight to http://169.254.169.254/ or another internal target.
    let currentUrl = url;
    let response = await fetch(currentUrl, {
      signal: controller.signal,
      redirect: "manual",
    });

    for (
      let redirects = 0;
      REDIRECT_STATUSES.has(response.status);
      redirects++
    ) {
      // Every early return below must cancel the undrained body — otherwise
      // the socket stays held until GC.
      if (redirects >= MAX_REDIRECTS) {
        await response.body?.cancel();
        return {
          ok: false,
          reason: "fetch-failed",
          message: "Too many redirects",
        };
      }

      const location = response.headers.get("location");
      if (!location) {
        await response.body?.cancel();
        return {
          ok: false,
          reason: "fetch-failed",
          message: "Redirect response missing Location header",
        };
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        await response.body?.cancel();
        return {
          ok: false,
          reason: "fetch-failed",
          message: "Invalid redirect URL",
        };
      }

      if (isDisallowedDocumentUrl(nextUrl.href)) {
        await response.body?.cancel();
        return {
          ok: false,
          reason: "fetch-failed",
          message: "Disallowed redirect URL",
        };
      }

      await response.body?.cancel();
      currentUrl = nextUrl.href;
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
      });
    }

    if (!response.ok) {
      await response.body?.cancel();
      return {
        ok: false,
        reason: "fetch-failed",
        message: `Request failed with status ${response.status}`,
      };
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_DOCUMENT_BYTES) {
      await response.body?.cancel();
      return {
        ok: false,
        reason: "fetch-failed",
        message: `Document exceeds the maximum size of ${MAX_DOCUMENT_BYTES} bytes`,
      };
    }

    // The content-length header is advisory and can be absent or lie, so stream
    // the body and enforce the byte cap on what we actually receive. Fall back
    // to arrayBuffer only when the body is not a readable stream.
    if (response.body === null) {
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_DOCUMENT_BYTES) {
        return {
          ok: false,
          reason: "fetch-failed",
          message: `Document exceeds the maximum size of ${MAX_DOCUMENT_BYTES} bytes`,
        };
      }
      return { ok: true, buffer: Buffer.from(arrayBuffer) };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    let chunk = await reader.read();
    while (!chunk.done) {
      totalBytes += chunk.value.byteLength;
      if (totalBytes > MAX_DOCUMENT_BYTES) {
        await reader.cancel();
        return {
          ok: false,
          reason: "fetch-failed",
          message: `Document exceeds the maximum size of ${MAX_DOCUMENT_BYTES} bytes`,
        };
      }
      chunks.push(chunk.value);
      chunk = await reader.read();
    }

    const buffer = Buffer.concat(chunks);
    // Buffer.concat copied every chunk — drop the originals so only one copy
    // of the document is alive when the extractor starts.
    chunks.length = 0;
    return { ok: true, buffer };
  } catch (error) {
    return {
      ok: false,
      reason: "fetch-failed",
      message: GENERIC_FETCH_ERROR,
      detail: describeError(error),
    };
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
};
