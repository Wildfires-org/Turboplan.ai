/**
 * Pure helpers for storing externally fetched documents in public blob
 * storage. Kept free of DB/network I/O so they can be unit-tested directly.
 */

import {
  DOCUMENT_MIME_EXTENSIONS,
  isBoxDownloadUrl,
  isDocumentMimeType,
} from "../document-preview-utils";

// Servers that do not label their files get one chance: a magic number.
const UNLABELLED_MIME_TYPES = new Set(["", "application/octet-stream"]);
const PDF_MIME = "application/pdf";
const DOC_MIME = "application/msword";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04" (docx container)
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .doc
const HTML_PREFIXES = ["<!doctype html", "<html"];
const HTML_SNIFF_BYTES = 512;

const MAX_FILENAME_LENGTH = 200;
const FILE_EXTENSION_PATTERN = /\.[a-z0-9]{1,5}$/i;
const FALLBACK_FILENAME = "document";

const startsWithBytes = (bytes: Uint8Array, prefix: number[]): boolean =>
  prefix.every((byte, index) => bytes[index] === byte);

/** Media type of a Content-Type header, lowercased, without parameters. */
export const parseMediaType = (contentTypeHeader: string | null): string => {
  return contentTypeHeader?.split(";")[0]?.trim().toLowerCase() ?? "";
};

/**
 * Filename from a Content-Disposition header. Prefers the RFC 5987
 * `filename*=` form over plain `filename=`. Returns null when absent.
 */
export const parseContentDispositionFilename = (
  header: string | null,
): string | null => {
  if (!header) {
    return null;
  }

  const extended = /filename\*\s*=\s*[\w!#$&+.^`|~-]*'[^']*'([^;]+)/i.exec(
    header,
  );
  if (extended) {
    const value = extended[1].trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]*))/i.exec(header);
  const value = (plain?.[1] ?? plain?.[2] ?? "").trim();
  return value || null;
};

/** Allowlisted document MIME type implied by a filename's extension. */
export const getDocumentMimeTypeForFilename = (
  filename: string | null,
): string | null => {
  const normalized = filename?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const match = Object.entries(DOCUMENT_MIME_EXTENSIONS).find(([, extension]) =>
    normalized.endsWith(extension),
  );
  return match?.[0] ?? null;
};

// Error pages and login walls are often served with a document type; never
// store markup as a PDF/Word file whatever the header claims.
const looksLikeHtml = (body: Uint8Array): boolean => {
  // Byte-wise decode: HTML markers are ASCII, and not every runtime's
  // TextDecoder supports single-byte encodings.
  const head = String.fromCharCode(...body.subarray(0, HTML_SNIFF_BYTES))
    .replace(/^\u00ef\u00bb\u00bf/, "")
    .trimStart()
    .toLowerCase();
  return HTML_PREFIXES.some((prefix) => head.startsWith(prefix));
};

/**
 * Resolve the MIME type to store for a downloaded document, or null when the
 * document must be rejected. Only allowlisted document types are returned.
 * Unlabelled responses are accepted only when the body's magic number matches
 * (PDF always; DOC/DOCX only when Content-Disposition names that extension).
 */
export const resolveDocumentMimeType = (
  contentTypeHeader: string | null,
  body: Uint8Array,
  contentDispositionHeader: string | null = null,
): string | null => {
  if (looksLikeHtml(body)) {
    return null;
  }

  const mimeType = parseMediaType(contentTypeHeader);
  if (isDocumentMimeType(mimeType)) {
    return mimeType;
  }

  if (!UNLABELLED_MIME_TYPES.has(mimeType)) {
    return null;
  }

  if (startsWithBytes(body, PDF_MAGIC)) {
    return PDF_MIME;
  }

  const dispositionType = getDocumentMimeTypeForFilename(
    parseContentDispositionFilename(contentDispositionHeader),
  );
  if (dispositionType === DOCX_MIME && startsWithBytes(body, ZIP_MAGIC)) {
    return DOCX_MIME;
  }
  if (dispositionType === DOC_MIME && startsWithBytes(body, OLE_MAGIC)) {
    return DOC_MIME;
  }
  return null;
};

/**
 * Make a single safe key segment: no separators, no control characters, no
 * characters that change URL meaning when the key is appended to the public
 * base URL verbatim (`?`, `#`, `%`), no leading dots, bounded length.
 */
const sanitizeFilenameSegment = (value: string): string =>
  value
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|#%]/g, "_")
    .replace(/^[.\s]+/, "")
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);

const lastPathSegment = (url: string): string => {
  // Box share links carry no filename in the path (`/index.php`).
  if (isBoxDownloadUrl(url)) {
    return "";
  }
  let segment: string;
  try {
    segment = new URL(url).pathname.split("/").pop() ?? "";
  } catch {
    return "";
  }
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/**
 * Build a filename for a downloaded document from its source URL, falling
 * back to the document title. A URL segment without a file extension (e.g.
 * `/attachment/<opaque id>`) is treated as an identifier, not a name, so the
 * title wins there. The result is always a single key segment (decoded `%2F` /
 * `%5C` cannot add path segments) and ends with the extension that matches
 * the stored MIME type.
 */
export const buildSafeDocumentFilename = (
  url: string,
  title: string,
  mimeType: string,
): string => {
  const extension = isDocumentMimeType(mimeType)
    ? DOCUMENT_MIME_EXTENSIONS[mimeType]
    : "";
  const rawSegment = lastPathSegment(url);
  const segmentName = sanitizeFilenameSegment(rawSegment);
  const titleName = sanitizeFilenameSegment(title);
  const base =
    (FILE_EXTENSION_PATTERN.test(rawSegment)
      ? segmentName
      : titleName || segmentName) ||
    titleName ||
    FALLBACK_FILENAME;

  if (!extension || base.toLowerCase().endsWith(extension)) {
    return base;
  }
  return `${base.slice(0, MAX_FILENAME_LENGTH - extension.length)}${extension}`;
};

/**
 * Read a response body, enforcing the byte cap as data arrives so a missing or
 * lying Content-Length cannot buffer an unbounded payload. Returns null when
 * the cap is exceeded.
 */
export const readBodyWithLimit = async (
  response: Response,
  maxBytes: number,
): Promise<Uint8Array | null> => {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    return null;
  }

  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    return buffer.byteLength > maxBytes ? null : buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  if (chunks.length === 1) {
    return chunks[0];
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};
