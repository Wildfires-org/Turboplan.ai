/**
 * Pure helpers for storing externally fetched documents in public blob
 * storage. Kept free of DB/network I/O so they can be unit-tested directly.
 */

import { isBoxDownloadUrl } from "../document-preview-utils";

// Same allowlist as the MCP document upload tool. Anything else (html, svg,
// scripts, ...) must never reach the public bucket with its upstream type.
const DOCUMENT_MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

// Servers that do not label their files get one chance: a PDF magic number.
const UNLABELLED_MIME_TYPES = new Set(["", "application/octet-stream"]);
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

const MAX_FILENAME_LENGTH = 200;
const FALLBACK_FILENAME = "document";

const startsWithBytes = (bytes: Uint8Array, prefix: number[]): boolean =>
  prefix.every((byte, index) => bytes[index] === byte);

/**
 * Resolve the MIME type to store for a downloaded document, or null when the
 * document must be rejected. Only allowlisted document types are returned.
 */
export const resolveDocumentMimeType = (
  contentTypeHeader: string | null,
  body: Uint8Array,
): string | null => {
  const mimeType = contentTypeHeader?.split(";")[0]?.trim().toLowerCase() ?? "";

  if (Object.hasOwn(DOCUMENT_MIME_EXTENSIONS, mimeType)) {
    return mimeType;
  }

  if (UNLABELLED_MIME_TYPES.has(mimeType) && startsWithBytes(body, PDF_MAGIC)) {
    return "application/pdf";
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
 * back to the document title. The result is always a single key segment
 * (decoded `%2F` / `%5C` cannot add path segments) and ends with the
 * extension that matches the stored MIME type.
 */
export const buildSafeDocumentFilename = (
  url: string,
  title: string,
  mimeType: string,
): string => {
  const extension = DOCUMENT_MIME_EXTENSIONS[mimeType] ?? "";
  const base =
    sanitizeFilenameSegment(lastPathSegment(url)) ||
    sanitizeFilenameSegment(title) ||
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
