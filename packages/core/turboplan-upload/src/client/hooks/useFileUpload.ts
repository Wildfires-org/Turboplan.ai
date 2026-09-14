"use client";

/**
 * React hook for file uploads
 *
 * Primary developer interface for file uploads in the application.
 * Provides state management, progress tracking, and error handling.
 *
 * @example
 * ```tsx
 * const { upload, isUploading, progress, error, result } = useFileUpload({
 *   maxSize: 50 * 1024 * 1024, // 50MB
 *   allowedTypes: ['image/*', 'application/pdf'],
 *   onSuccess: (result) => console.log('Upload complete:', result.url),
 * });
 *
 * const handleFileSelect = async (file: File) => {
 *   try {
 *     await upload(file);
 *   } catch (err) {
 *     // Error is also available in the error state
 *   }
 * };
 * ```
 */

import { useCallback, useState } from "react";

import type {
  UploadResult,
  UseFileUploadOptions,
  UseFileUploadReturn,
} from "../../types";
import { UploadClient } from "../UploadClient";

/**
 * React hook for file uploads with state management
 *
 * Manages upload state, progress tracking, and error handling.
 * Calls UploadClient.upload() internally with proper state updates.
 *
 * @param options - Upload configuration options
 * @returns Upload state and control functions
 */
export const useFileUpload = (
  options: UseFileUploadOptions = {},
): UseFileUploadReturn => {
  // State management
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  /**
   * Upload a file to Vercel Blob storage
   *
   * @param file - The file to upload
   * @returns Promise resolving to upload result
   * @throws Error if upload fails (also sets error state)
   */
  const upload = useCallback(
    async (file: File): Promise<UploadResult> => {
      // Reset state
      setIsUploading(true);
      setError(null);
      setProgress(0);
      setResult(null);

      try {
        // Create upload client
        const client = new UploadClient();

        // Upload file with progress tracking
        const uploadResult = await client.upload(file, {
          ...options,
          // Override progress callback to update state
          onProgress: (percent) => {
            setProgress(percent);
            // Call user's progress callback if provided
            options.onProgress?.(percent);
          },
          // Override success callback to update state
          onSuccess: (uploadResult) => {
            setResult(uploadResult);
            // Call user's success callback if provided
            options.onSuccess?.(uploadResult);

            // Auto-reset if enabled (after a short delay for user feedback)
            if (options.autoReset) {
              setTimeout(() => {
                setProgress(0);
                setResult(null);
              }, 1500);
            }
          },
          // Override error callback to update state
          onError: (err) => {
            setError(err);
            // Call user's error callback if provided
            options.onError?.(err);
          },
        });

        return uploadResult;
      } catch (err) {
        // Ensure error is set in state (should already be set by onError callback)
        const uploadError =
          err instanceof Error ? err : new Error("Upload failed");
        setError(uploadError);

        // Re-throw so caller can handle if needed
        throw uploadError;
      } finally {
        // Always clear uploading state when complete (success or failure)
        setIsUploading(false);
      }
    },
    [options],
  );

  /**
   * Reset upload state
   * Clears error, progress, and result
   * Useful for clearing errors before retry or preparing for new upload
   */
  const reset = useCallback(() => {
    setError(null);
    setProgress(0);
    setResult(null);
  }, []);

  return {
    upload,
    isUploading,
    progress,
    error,
    result,
    reset,
  };
};
