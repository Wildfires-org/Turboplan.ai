"use client";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { getWebEnv } from "@wildfires-org/turboplan-env";

import {
  ABSOLUTE_MAX_FILE_SIZE,
  UploadError,
  UploadErrorCode,
  type UploadOptions,
  type UploadResult,
} from "../types";

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export class UploadClient {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = new ApiClient();
  }

  async upload(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    const maxSize = options.maxSize || ABSOLUTE_MAX_FILE_SIZE;

    try {
      this.validateFile(file, { ...options, maxSize });

      if (options.onProgress) {
        options.onProgress(0);
      }

      const { data: tokenData, error: tokenError } = await this.apiClient.get<{
        token: string;
      }>("/api/auth/upload-token");

      if (tokenError || !tokenData?.token) {
        throw new UploadError(
          "Authentication required. Please log in to upload files.",
          UploadErrorCode.UNAUTHORIZED,
        );
      }

      const token = tokenData.token;
      const ENV = getWebEnv();

      const presignResponse = await fetch(
        `${ENV.SERVER_URL}/api/upload/presign?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            fileSize: file.size,
            maxSize,
          }),
        },
      );

      if (!presignResponse.ok) {
        let errorMsg = "Failed to get presigned upload URL";
        try {
          const errBody = await presignResponse.json();
          if (errBody.error) {
            errorMsg = errBody.error;
          }
        } catch {
          // Use default message
        }
        throw new UploadError(errorMsg, UploadErrorCode.SERVER_ERROR);
      }

      const { uploadUrl, publicUrl, key }: PresignResponse =
        await presignResponse.json();

      await this.putToPresignedUrl(
        uploadUrl,
        file,
        file.type || "application/octet-stream",
        options.onProgress,
      );

      if (options.onProgress) {
        options.onProgress(100);
      }

      const result: UploadResult = {
        url: publicUrl,
        pathname: key,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: new Date(),
      };

      options.onSuccess?.(result);

      return result;
    } catch (error) {
      const uploadError = this.handleError(error);

      options.onError?.(uploadError);

      throw uploadError;
    }
  }

  private putToPresignedUrl = (
    url: string,
    file: File,
    contentType: string,
    onProgress?: (percent: number) => void,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", contentType);

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () =>
        reject(new Error("Network error during upload")),
      );
      xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

      xhr.send(file);
    });
  };

  /**
   * Validate file before upload
   * Checks file size and MIME type against configured limits
   *
   * @param file - File to validate
   * @param options - Validation options with maxSize required
   * @throws UploadError if validation fails
   */
  private validateFile(
    file: File,
    options: Required<Pick<UploadOptions, "maxSize">> & UploadOptions,
  ): void {
    // Check absolute maximum
    if (file.size > ABSOLUTE_MAX_FILE_SIZE) {
      throw new UploadError(
        `File exceeds absolute maximum size of ${this.formatFileSize(ABSOLUTE_MAX_FILE_SIZE)}. ` +
          `Your file: ${this.formatFileSize(file.size)}`,
        UploadErrorCode.FILE_TOO_LARGE,
        {
          fileSize: file.size,
          maxSize: ABSOLUTE_MAX_FILE_SIZE,
          fileName: file.name,
        },
      );
    }

    // Check requested maximum
    if (file.size > options.maxSize) {
      throw new UploadError(
        `File too large. Maximum size: ${this.formatFileSize(options.maxSize)}. ` +
          `Your file: ${this.formatFileSize(file.size)}`,
        UploadErrorCode.FILE_TOO_LARGE,
        {
          fileSize: file.size,
          maxSize: options.maxSize,
          fileName: file.name,
        },
      );
    }

    // Validate MIME type if allowedTypes is specified
    if (options.allowedTypes && options.allowedTypes.length > 0) {
      if (!this.isAllowedType(file.type, options.allowedTypes)) {
        throw new UploadError(
          `File type not allowed: ${file.type || "unknown"}. ` +
            `Allowed types: ${options.allowedTypes.join(", ")}`,
          UploadErrorCode.INVALID_FILE_TYPE,
          {
            fileType: file.type,
            allowedTypes: options.allowedTypes,
            fileName: file.name,
          },
        );
      }
    }
  }

  /**
   * Check if file type is allowed based on allowedTypes patterns
   * Supports wildcards like 'image/*' or 'video/*'
   *
   * @param fileType - MIME type of the file
   * @param allowedTypes - Array of allowed MIME type patterns
   * @returns true if file type is allowed
   */
  private isAllowedType(fileType: string, allowedTypes: string[]): boolean {
    if (!fileType) {
      return false;
    }

    return allowedTypes.some((allowedType) => {
      // Exact match
      if (allowedType === fileType) {
        return true;
      }

      // Wildcard match (e.g., 'image/*' matches 'image/jpeg')
      if (allowedType.endsWith("/*")) {
        const prefix = allowedType.slice(0, -2);
        return fileType.startsWith(prefix + "/");
      }

      return false;
    });
  }

  /**
   * Transform generic errors into typed UploadError instances
   * Provides context-specific error messages and codes
   *
   * @param error - Original error from upload process
   * @returns Typed UploadError with appropriate code and message
   */
  private handleError(error: unknown): UploadError {
    // Already an UploadError, return as-is
    if (error instanceof UploadError) {
      return error;
    }

    // Standard Error object
    if (error instanceof Error) {
      // Check for common error patterns
      const message = error.message.toLowerCase();

      // Network errors
      if (message.includes("network") || message.includes("fetch")) {
        return new UploadError(
          "Upload failed due to network error. Please check your connection and try again.",
          UploadErrorCode.NETWORK_ERROR,
          { originalError: error.message },
        );
      }

      // Auth errors
      if (message.includes("unauthorized") || message.includes("401")) {
        return new UploadError(
          "Upload failed: You must be logged in to upload files.",
          UploadErrorCode.UNAUTHORIZED,
          { originalError: error.message },
        );
      }

      // Server errors
      if (message.includes("server") || message.includes("500")) {
        return new UploadError(
          "Upload failed due to server error. Please try again later.",
          UploadErrorCode.SERVER_ERROR,
          { originalError: error.message },
        );
      }

      // Generic error with original message
      return new UploadError(
        `Upload failed: ${error.message}`,
        UploadErrorCode.UNKNOWN_ERROR,
        { originalError: error.message },
      );
    }

    // Unknown error type
    return new UploadError(
      "Upload failed due to an unknown error. Please try again.",
      UploadErrorCode.UNKNOWN_ERROR,
      { originalError: String(error) },
    );
  }

  /**
   * Format file size in human-readable format
   *
   * @param bytes - File size in bytes
   * @returns Formatted string (e.g., "15.5 MB")
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}
