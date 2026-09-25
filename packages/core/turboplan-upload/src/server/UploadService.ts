import {
  ABSOLUTE_MAX_FILE_SIZE,
  isAllowedUploadContentType,
  normalizeContentType,
  UploadError,
  UploadErrorCode,
} from "../types";
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

export const sanitizeFilename = (filename: string): string => {
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

  let sanitized = filename.replace(INVALID_FILENAME_CHARS, "");

  sanitized = sanitized.trim().replace(/^\.+/, "");

  if (!sanitized) {
    sanitized = `file-${Date.now()}`;
  }

  if (sanitized.length > MAX_FILENAME_LENGTH) {
    const extMatch = sanitized.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : "";
    const nameLength = MAX_FILENAME_LENGTH - ext.length;
    sanitized = sanitized.slice(0, nameLength) + ext;
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
}

export const uploadService = new UploadService();
