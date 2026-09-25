import mammoth from "mammoth";
import { getDocumentProxy } from "unpdf";

import { DOC_MIME, DOCX_MIME, PDF_MIME } from "./document-mime";

/**
 * Maximum number of characters returned for a single document. Extracted text
 * longer than this is sliced and flagged with `truncated: true`.
 */
export const MAX_EXTRACTED_CHARS = 40_000;

/**
 * Hard cap on how many PDF pages are read. Extraction stops here and flags
 * `truncated: true` — a 512MB box cannot afford to walk a 10k-page scan even
 * though each page is released right after it is read.
 */
export const MAX_PDF_PAGES = 400;

const FETCH_TIMEOUT_MS = 30_000;
const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024; // 50MB
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

export type ExtractionResult =
  | { ok: true; text: string; truncated: boolean }
  | {
      ok: false;
      reason: "unsupported-format" | "fetch-failed" | "extraction-failed";
      message?: string;
    };

type FetchResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; reason: "fetch-failed"; message: string };

/**
 * Collapse runs of 3+ newlines down to a blank line and trim surrounding
 * whitespace. Intentionally light-touch so document structure is preserved.
 */
const normalizeWhitespace = (raw: string): string => {
  return raw.replace(/\n{3,}/g, "\n\n").trim();
};

const capText = (text: string): { text: string; truncated: boolean } => {
  if (text.length <= MAX_EXTRACTED_CHARS) {
    return { text, truncated: false };
  }

  return { text: text.slice(0, MAX_EXTRACTED_CHARS), truncated: true };
};

const fetchDocument = async (
  url: string,
  externalSignal?: AbortSignal,
): Promise<FetchResult> => {
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
    const message =
      error instanceof Error ? error.message : "Unknown fetch error";
    return { ok: false, reason: "fetch-failed", message };
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
};

/**
 * View the fetched bytes without copying them — `new Uint8Array(buffer)` would
 * duplicate the whole document, and a 50MB PDF cannot afford a second copy.
 *
 * pdf.js transfers (and thereby detaches) the ArrayBuffer it is handed, so the
 * view is only safe when the Buffer owns its ArrayBuffer outright. Buffers
 * under 4KB come out of Node's shared allocation pool, where detaching would
 * take unrelated Buffers down with it; those get copied instead, which costs
 * nothing at that size.
 */
const toPdfBytes = (buffer: Buffer): Uint8Array => {
  const ownsWholeArrayBuffer =
    buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength;

  if (!ownsWholeArrayBuffer) {
    return new Uint8Array(buffer);
  }

  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
};

/**
 * Page-by-page PDF text extraction. Mirrors unpdf's `extractText(pdf, {
 * mergePages: true })` output (items joined by `str`, a newline wherever
 * `hasEOL` is set, pages joined by "\n", then all whitespace collapsed), but
 * releases each page as soon as it is read and stops once enough text has been
 * collected — unpdf resolves every page in parallel and holds all of them.
 */
const extractPdfText = async (
  buffer: Buffer,
): Promise<{ text: string; truncated: boolean }> => {
  const pdf = await getDocumentProxy(toPdfBytes(buffer));

  try {
    const pageLimit = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const pageTexts: string[] = [];
    let accumulatedChars = 0;
    let pagesRead = 0;

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => {
            if (!("str" in item) || item.str == null) {
              return "";
            }
            return item.hasEOL ? `${item.str}\n` : item.str;
          })
          .join("")
          // Collapsing per page keeps the accumulator small; the final
          // collapse below makes the result identical to unpdf's.
          .replace(/\s+/g, " ");

        pageTexts.push(pageText);
        accumulatedChars += pageText.length;
        pagesRead = pageNumber;
      } finally {
        page.cleanup();
      }

      if (accumulatedChars >= MAX_EXTRACTED_CHARS) {
        break;
      }
    }

    return {
      text: pageTexts.join("\n").replace(/\s+/g, " "),
      truncated: pagesRead < pdf.numPages,
    };
  } finally {
    await pdf.destroy();
  }
};

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIR_SIGNATURE = 0x02014b50;
// EOCD record is 22 bytes plus an up-to-65535-byte comment.
const ZIP_EOCD_SEARCH_WINDOW = 22 + 65535;
const MAX_DOCX_ENTRIES = 10_000;
const MAX_DOCX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * Pre-scan a .docx (zip) central directory and reject archives whose declared
 * entry count or total uncompressed size is excessive. mammoth inflates the
 * archive fully into memory with no internal limit, so a small highly
 * compressed upload ("zip bomb") could otherwise exhaust the worker — the
 * upstream 50MB cap only bounds the COMPRESSED size. Reads only fixed-size
 * headers; nothing is decompressed. Returns an error message, or null when
 * the archive looks sane.
 */
const validateDocxArchive = (buffer: Buffer): string | null => {
  const searchStart = Math.max(0, buffer.length - ZIP_EOCD_SEARCH_WINDOW);
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= searchStart; i--) {
    if (buffer.readUInt32LE(i) === ZIP_EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    return "Not a valid .docx archive";
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (entryCount > MAX_DOCX_ENTRIES) {
    return `Archive has too many entries (${entryCount})`;
  }
  // 0xffff / 0xffffffff are zip64 escape markers — a .docx needing zip64 is
  // far beyond any legitimate document we accept.
  if (entryCount === 0xffff || centralDirOffset === 0xffffffff) {
    return "Archive requires zip64 (too large)";
  }

  let offset = centralDirOffset;
  let totalUncompressedBytes = 0;
  for (let i = 0; i < entryCount; i++) {
    if (
      offset + 46 > buffer.length ||
      buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIR_SIGNATURE
    ) {
      return "Malformed .docx central directory";
    }
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    if (uncompressedSize === 0xffffffff) {
      return "Archive requires zip64 (too large)";
    }
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
      return "Archive decompresses beyond the allowed size";
    }
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return null;
};

const extractDocxText = async (buffer: Buffer): Promise<string> => {
  const archiveIssue = validateDocxArchive(buffer);
  if (archiveIssue) {
    throw new Error(archiveIssue);
  }
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
};

/**
 * Download a project document from its public R2 URL and extract its plain
 * text. Supports PDF (via unpdf) and .docx (via mammoth). Legacy .doc files are
 * not supported. Never throws — all failure modes are returned as a discriminated
 * `ExtractionResult`.
 */
export const extractDocumentText = async (
  {
    url,
    mimeType,
  }: {
    url: string;
    mimeType: string;
  },
  options?: { signal?: AbortSignal },
): Promise<ExtractionResult> => {
  const normalizedMime = mimeType.toLowerCase().trim();

  if (normalizedMime === DOC_MIME) {
    return {
      ok: false,
      reason: "unsupported-format",
      message:
        "Legacy .doc files are not supported. Convert the document to PDF or .docx and re-upload.",
    };
  }

  if (normalizedMime !== PDF_MIME && normalizedMime !== DOCX_MIME) {
    return {
      ok: false,
      reason: "unsupported-format",
      message: `Unsupported document type: ${mimeType}`,
    };
  }

  const fetched = await fetchDocument(url, options?.signal);
  if (!fetched.ok) {
    return fetched;
  }

  try {
    const extracted =
      normalizedMime === PDF_MIME
        ? await extractPdfText(fetched.buffer)
        : { text: await extractDocxText(fetched.buffer), truncated: false };

    const normalized = normalizeWhitespace(extracted.text);
    const { text, truncated } = capText(normalized);

    return { ok: true, text, truncated: truncated || extracted.truncated };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown extraction error";
    return { ok: false, reason: "extraction-failed", message };
  }
};
