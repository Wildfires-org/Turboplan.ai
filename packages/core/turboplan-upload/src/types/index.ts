/**
 * Type definitions for the turboplan-upload package
 *
 * This file contains all shared type definitions for upload operations.
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Absolute maximum file size: 200MB
 * No upload can exceed this limit, regardless of configuration
 */
export const ABSOLUTE_MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

/**
 * The single source of truth for what may be stored through the upload
 * endpoints. Enforced SERVER-SIDE at presign — the per-call `allowedTypes` on
 * `UploadOptions` is a client-side UX filter and is trivially bypassed by
 * calling `/api/upload/presign` directly.
 *
 * It is an allow list, not a deny list: a deny list of "dangerous" types is
 * always incomplete (`application/*+xml`, `text/*` variants, novel types the
 * browser learns to render), so anything not listed here is refused.
 *
 * Entries are the union of what real call sites need:
 * - images: avatars, organization logos, document logos, chat attachments
 * - documents: project document uploads (PDF / DOC / DOCX)
 * - archives + json: geospatial layer uploads (shapefile zips, GeoJSON)
 *
 * Wildcards (`type/*`) are supported and match the whole category. Adding a
 * type is a one-line change here; do not re-introduce per-endpoint lists.
 */
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Geospatial / archives
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
  "application/geo+json",
] as const;

/**
 * Strips any `; charset=...` parameter and lowercases, so comparisons run
 * against the bare media type.
 */
export const normalizeContentType = (contentType: string): string => {
  return contentType.split(";")[0].trim().toLowerCase();
};

/**
 * True when `contentType` is on {@link ALLOWED_UPLOAD_CONTENT_TYPES}. Wildcard
 * entries use the same semantics as the client-side `allowedTypes` check.
 */
export const isAllowedUploadContentType = (contentType: string): boolean => {
  const normalized = normalizeContentType(contentType);
  if (!normalized) {
    return false;
  }

  return ALLOWED_UPLOAD_CONTENT_TYPES.some((allowed) => {
    if (allowed === normalized) {
      return true;
    }
    if (allowed.endsWith("/*")) {
      return normalized.startsWith(`${allowed.slice(0, -2)}/`);
    }
    return false;
  });
};

// ============================================================================
// Upload Result Types
// ============================================================================

/**
 * Successful upload result returned after file is uploaded to R2 storage
 */
export interface UploadResult {
  /** Public URL to access the uploaded file */
  url: string;
  /** Key/pathname of the uploaded file in R2 storage */
  pathname: string;
  /** MIME type of the uploaded file */
  contentType: string;
  /** Size of the uploaded file in bytes */
  size?: number;
  /** Upload timestamp */
  uploadedAt?: Date;
}

// ============================================================================
// Upload Progress Types
// ============================================================================

/**
 * Upload progress information
 */
export interface UploadProgress {
  /** Number of bytes uploaded so far */
  loaded: number;
  /** Total number of bytes to upload */
  total: number;
  /** Upload progress as a percentage (0-100) */
  percentage: number;
}

// ============================================================================
// Upload Options Types
// ============================================================================

/**
 * Configuration options for file upload
 */
export interface UploadOptions {
  /**
   * Maximum allowed file size in bytes
   * Defaults to DEFAULT_MAX_FILE_SIZE (50MB) if not specified
   * Cannot exceed ABSOLUTE_MAX_FILE_SIZE (200MB)
   */
  maxSize?: number;

  /**
   * Array of allowed MIME types (e.g., ['image/jpeg', 'image/png', 'application/zip'])
   * Supports wildcards (e.g., 'image/*', 'video/*')
   * If not specified, all file types are allowed
   */
  allowedTypes?: string[];

  /**
   * Callback invoked during upload to report progress
   * @param percent - Upload progress percentage (0-100)
   */
  onProgress?: (percent: number) => void;

  /**
   * Callback invoked when upload completes successfully
   * @param result - Upload result containing file URL and metadata
   */
  onSuccess?: (result: UploadResult) => void;

  /**
   * Callback invoked when upload fails
   * @param error - Error that occurred during upload
   */
  onError?: (error: UploadError) => void;

  /**
   * Additional metadata to attach to the upload
   * This can be used to pass context-specific information to the server
   */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Options for the useFileUpload React hook
 * Extends UploadOptions with additional hook-specific configuration
 */
export interface UseFileUploadOptions extends UploadOptions {
  /**
   * Auto-reset error and result state after successful upload
   * Defaults to false
   */
  autoReset?: boolean;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * File validation rules used by both client and server
 */
export interface FileValidationRules {
  /** Maximum file size in bytes */
  maxSize: number;
  /** Allowed MIME types (optional) */
  allowedTypes?: string[];
  /** Allowed file extensions (optional, e.g., ['.jpg', '.png']) */
  allowedExtensions?: string[];
}

/**
 * Result of file validation
 */
export interface ValidationResult {
  /** Whether the file passed validation */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Details about validation failure (for debugging) */
  details?: {
    reason: "size" | "type" | "extension" | "other";
    fileSize?: number;
    maxSize?: number;
    fileType?: string;
    allowedTypes?: string[];
  };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for upload failures
 */
export enum UploadErrorCode {
  /** File size exceeds maximum allowed size */
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  /** File type is not allowed */
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  /** User is not authenticated */
  UNAUTHORIZED = "UNAUTHORIZED",
  /** Network error during upload */
  NETWORK_ERROR = "NETWORK_ERROR",
  /** Server error during upload */
  SERVER_ERROR = "SERVER_ERROR",
  /** Upload was cancelled by user */
  UPLOAD_CANCELLED = "UPLOAD_CANCELLED",
  /** Unknown error occurred */
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  /** Validation error on server */
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

/**
 * Typed error for upload failures
 * Extends Error with additional context about the failure
 */
export class UploadError extends Error {
  constructor(
    message: string,
    public code: UploadErrorCode,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "UploadError";

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UploadError);
    }
  }
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return value from useFileUpload React hook
 */
export interface UseFileUploadReturn {
  /**
   * Initiates file upload
   * @param file - File to upload
   * @returns Promise that resolves when upload completes
   */
  upload: (file: File) => Promise<UploadResult>;

  /** Whether an upload is currently in progress */
  isUploading: boolean;

  /** Current upload progress percentage (0-100) */
  progress: number;

  /** Error that occurred during upload (null if no error) */
  error: UploadError | Error | null;

  /** Result of successful upload (null if not yet completed) */
  result: UploadResult | null;

  /**
   * Resets error, progress, and result state
   * Useful for clearing errors before retry
   */
  reset: () => void;
}
