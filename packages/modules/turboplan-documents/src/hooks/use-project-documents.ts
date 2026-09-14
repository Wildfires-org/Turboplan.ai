"use client";

import { useCallback, useState } from "react";

import useSWR from "swr";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import { useFileUpload } from "@wildfires-org/turboplan-upload/client";

import type {
  ProjectDocument,
  UseProjectDocumentsOptions,
  UseProjectDocumentsReturn,
} from "../types";

const apiClient = new ApiClient();

// Allowed MIME types for document uploads
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Hook for managing project documents
 */
export function useProjectDocuments({
  projectId,
  source,
}: UseProjectDocumentsOptions): UseProjectDocumentsReturn {
  const url = source
    ? `/api/project-documents?projectId=${encodeURIComponent(projectId)}&source=${encodeURIComponent(source)}`
    : `/api/project-documents?projectId=${encodeURIComponent(projectId)}`;
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);

  const {
    data: documents,
    error,
    isLoading,
    mutate,
  } = useSWR<ProjectDocument[]>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 0,
  });

  // Use the upload hook from turboplan-upload
  const {
    upload: uploadToBlob,
    isUploading,
    progress: uploadProgress,
    error: uploadError,
    reset: resetUpload,
  } = useFileUpload({
    maxSize: MAX_FILE_SIZE,
    allowedTypes: ALLOWED_MIME_TYPES,
  });

  /**
   * Upload a document and create the database record
   */
  const uploadDocument = useCallback(
    async (file: File) => {
      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(
          "File type not allowed. Only PDF and Word documents are supported.",
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error("File size exceeds maximum allowed (50MB)");
      }

      // Upload to storage
      const uploadResult = await uploadToBlob(file);

      // Create the database record
      const { data, error: apiError } = await apiClient.post<ProjectDocument>(
        "/api/project-documents",
        {
          projectId,
          filename: uploadResult.pathname.split("/").pop() || file.name,
          originalFilename: file.name,
          mimeType: file.type,
          size: file.size,
          url: uploadResult.url,
        },
      );

      if (apiError) {
        throw new Error(apiError);
      }

      // Optimistically update the cache with the new document
      await mutate(
        (currentDocuments) =>
          currentDocuments ? [data!, ...currentDocuments] : [data!],
        { revalidate: true },
      );

      return data ?? undefined;
    },
    [projectId, uploadToBlob, mutate],
  );

  /**
   * Delete a document
   */
  const deleteDocument = useCallback(
    async (documentId: string) => {
      setIsDeleting(documentId);

      try {
        const { error: apiError } = await apiClient.delete(
          `/api/project-documents/${documentId}`,
        );

        if (apiError) {
          throw new Error(apiError);
        }

        // Optimistically remove the document from cache
        await mutate(
          (currentDocuments) =>
            currentDocuments
              ? currentDocuments.filter((d) => d.id !== documentId)
              : [],
          { revalidate: true },
        );
      } finally {
        setIsDeleting(null);
      }
    },
    [mutate],
  );

  /**
   * Rename a document (updates its display filename only)
   */
  const renameDocument = useCallback(
    async (documentId: string, newName: string) => {
      setIsRenaming(documentId);

      try {
        const { error: apiError } = await apiClient.patch<ProjectDocument>(
          `/api/project-documents/${documentId}`,
          { originalFilename: newName },
        );

        if (apiError) {
          throw new Error(apiError);
        }

        // Optimistically update the renamed document in cache
        await mutate(
          (currentDocuments) =>
            currentDocuments
              ? currentDocuments.map((d) =>
                  d.id === documentId ? { ...d, originalFilename: newName } : d,
                )
              : [],
          { revalidate: true },
        );
      } finally {
        setIsRenaming(null);
      }
    },
    [mutate],
  );

  /**
   * Refresh the documents list
   */
  const refreshDocuments = useCallback(() => {
    return mutate();
  }, [mutate]);

  return {
    documents: documents ?? [],
    isLoading,
    error: error?.message ?? null,
    uploadDocument,
    deleteDocument,
    renameDocument,
    isUploading,
    uploadProgress,
    uploadError,
    resetUpload,
    isDeleting,
    isRenaming,
    refreshDocuments,
  };
}
