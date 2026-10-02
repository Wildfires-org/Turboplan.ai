import {
  ABSOLUTE_MAX_FILE_SIZE,
  isAllowedUploadContentType,
  isProjectDocumentMimeType,
  LANDING_FILENAME_MAX_LENGTH,
  LANDING_UPLOAD_PREFIX,
  normalizeContentType,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
  UploadError,
  UploadErrorCode,
} from "../types";
import { LANDING_FILENAME_STRIP_CHARS } from "./landing-uploads";
import { generatePresignedUploadUrl } from "./r2-client";
import { uniqueStorageName } from "./storage-key";

// ============================================================================
// Constants
// ============================================================================

const MAX_FILENAME_LENGTH = 255;

// Includes path separators (`/` and `\`) so a filename cannot create nested
// keys or escape the caller's own `uploads/{userId}/` prefix.
const INVALID_FILENAME_CHARS = /[<>:"|?*/\\\x00-\x1F]/g;

const PATH_TRAVERSAL_PATTERN = /\.\.[\/\\]/;

// A surrogate half with no partner (only possible from crafted input) is not
// a character and makes `encodeURIComponent` throw "URI malformed". Line and
// paragraph separators (U+2028/U+2029) render as line breaks in some places a
// name is shown or quoted.
const UNSAFE_UNICODE_CHARS = /[\p{Cs}\p{Zl}\p{Zp}]/gu;

// Content types a browser will render/execute inline. Storing an object with
// one of these plus a public, inline-served URL turns any upload endpoint into
// stored XSS. The allow list in ../types already excludes them; this stays as
// defence in depth so a future wildcard entry (e.g. `image/*`, which would
// otherwise admit `image/svg+xml`) cannot quietly re-open the hole.
const DANGEROUS_CONTENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/xml",
  "text/xml",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
]);

/**
 * Server-side content-type gate for every stored object. Throws on anything
 * outside the allow list; callers map this to a 400.
 */
export const assertAllowedContentType = (contentType: string): void => {
  const normalized = normalizeContentType(contentType);

  if (
    !isAllowedUploadContentType(normalized) ||
    DANGEROUS_CONTENT_TYPES.has(normalized)
  ) {
    throw new UploadError(
      "Unsupported file type",
      UploadErrorCode.VALIDATION_ERROR,
      { contentType },
    );
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Cut `value` to at most `maxUnits` UTF-16 code units without splitting a code
 * point: a cut through a surrogate pair (any emoji) leaves a lone half, which
 * makes the key unencodable. Measuring in code units keeps every existing
 * bound (key segment, filename column, R2's 1024-byte key limit) intact.
 */
const truncateToCodePoints = (value: string, maxUnits: number): string => {
  let result = "";
  for (const codePoint of value) {
    if (result.length + codePoint.length > maxUnits) {
      break;
    }
    result += codePoint;
  }
  return result;
};

export const sanitizeFilename = (
  filename: string,
  maxLength: number = MAX_FILENAME_LENGTH,
): string => {
  if (!filename || typeof filename !== "string") {
    throw new UploadError(
      "Invalid filename provided",
      UploadErrorCode.VALIDATION_ERROR,
      { filename },
    );
  }

  if (PATH_TRAVERSAL_PATTERN.test(filename)) {
    throw new UploadError(
      "Filename contains invalid path characters",
      UploadErrorCode.VALIDATION_ERROR,
      { filename },
    );
  }

  let sanitized = filename
    .replace(INVALID_FILENAME_CHARS, "")
    .replace(UNSAFE_UNICODE_CHARS, "");

  sanitized = sanitized.trim().replace(/^\.+/, "");

  if (!sanitized) {
    sanitized = `file-${Date.now()}`;
  }

  if (sanitized.length > maxLength) {
    const extMatch = sanitized.match(/\.[^.]+$/);
    const ext = extMatch && extMatch[0].length < maxLength ? extMatch[0] : "";
    sanitized = truncateToCodePoints(sanitized, maxLength - ext.length) + ext;
  }

  return sanitized;
};

// ============================================================================
// Main Upload Service
// ============================================================================

export class UploadService {
  private validateAuth(userId?: string): void {
    if (!userId) {
      throw new UploadError(
        "Authentication required",
        UploadErrorCode.UNAUTHORIZED,
      );
    }
  }

  async generatePresignedUrl(
    filename: string,
    contentType: string,
    fileSize: number,
    userId?: string,
    maxSize?: number,
  ): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
    this.validateAuth(userId);

    assertAllowedContentType(contentType);

    const sanitizedFilename = sanitizeFilename(filename);

    const effectiveMax = maxSize ?? ABSOLUTE_MAX_FILE_SIZE;

    if (effectiveMax > ABSOLUTE_MAX_FILE_SIZE) {
      throw new UploadError(
        `Max size cannot exceed ${ABSOLUTE_MAX_FILE_SIZE} bytes`,
        UploadErrorCode.VALIDATION_ERROR,
        { maxSize: effectiveMax, absoluteMax: ABSOLUTE_MAX_FILE_SIZE },
      );
    }

    if (fileSize > effectiveMax) {
      throw new UploadError(
        `File size ${fileSize} exceeds maximum of ${effectiveMax} bytes`,
        UploadErrorCode.VALIDATION_ERROR,
        { fileSize, maxSize: effectiveMax },
      );
    }

    const key = `uploads/${userId}/${uniqueStorageName(sanitizedFilename)}`;

    return generatePresignedUploadUrl(key, contentType, fileSize);
  }

  /**
   * Presigned PUT for a document an anonymous visitor attaches on the landing
   * page. No identity, so the rules are the strict project-document ones
   * (PDF / Word, project document size cap) and the key lands in the
   * `landing-uploads/` staging prefix until `claimLandingUpload` moves it.
   * The content type must match exactly: it is signed into the URL (see
   * `generatePresignedUploadUrl`), so the browser's PUT has to send the same
   * `Content-Type` and storage refuses any other.
   */
  async generateLandingPresignedUrl(
    filename: string,
    contentType: string,
    fileSize: number,
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!isProjectDocumentMimeType(contentType)) {
      throw new UploadError(
        "Only PDF and Word documents can be attached",
        UploadErrorCode.VALIDATION_ERROR,
        { contentType },
      );
    }

    if (
      !Number.isInteger(fileSize) ||
      fileSize <= 0 ||
      fileSize > PROJECT_DOCUMENT_MAX_FILE_SIZE
    ) {
      throw new UploadError(
        `File size must be between 1 and ${PROJECT_DOCUMENT_MAX_FILE_SIZE} bytes`,
        UploadErrorCode.VALIDATION_ERROR,
        { fileSize, maxSize: PROJECT_DOCUMENT_MAX_FILE_SIZE },
      );
    }

    const sanitizedFilename = sanitizeFilename(
      filename.replace(LANDING_FILENAME_STRIP_CHARS, ""),
      LANDING_FILENAME_MAX_LENGTH,
    );

    const key = `${LANDING_UPLOAD_PREFIX}/${uniqueStorageName(sanitizedFilename)}`;

    const { uploadUrl } = await generatePresignedUploadUrl(
      key,
      contentType,
      fileSize,
    );

    return { uploadUrl, key };
  }
}

export const uploadService = new UploadService();
