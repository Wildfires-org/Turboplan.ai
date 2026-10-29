"use client";

import { useCallback, useMemo, useState } from "react";

import useSWR from "swr";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";
import { useFileUpload } from "@wildfires-org/turboplan-upload/client";
import {
  isProjectDocumentMimeType,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
  PROJECT_DOCUMENT_MIME_TYPES,
} from "@wildfires-org/turboplan-upload/types";

import {
  getPendingExtractionPollInterval,
  type ProjectDocument,
  trackPendingSince,
  type UseProjectDocumentsOptions,
  type UseProjectDocumentsReturn,
} from "../types";

const apiClient = new ApiClient();

const ALLOWED_MIME_TYPES = Object.keys(PROJECT_DOCUMENT_MIME_TYPES);

const NOTHING_PENDING: ReadonlyMap<string, number> = new Map();

/**
 * Hook for managing project documents
 */
export function useProjectDocuments({
  projectId,
  source,
  refreshInterval = 0,
  pollPendingExtraction = false,
}: UseProjectDocumentsOptions): UseProjectDocumentsReturn {
  const url = source
    ? `/api/project-documents?projectId=${encodeURIComponent(projectId)}&source=${encodeURIComponent(source)}`
    : `/api/project-documents?projectId=${encodeURIComponent(projectId)}`;
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);

  // When this client first saw each document pending. Server `createdAt`
  // would do, but a skewed server clock would stretch or cut the schedule.
  const [pendingSince, setPendingSince] =
    useState<ReadonlyMap<string, number>>(NOTHING_PENDING);

  // SWR evaluates a function interval only when polling (re)starts and after
  // each poll, so a list that loads, or gains a pending document, while
  // polling is off would never start it. A new function per set of pending
  // documents restarts polling whenever that set changes.
  const pendingExtractionInterval = useMemo(
    () =>
      pendingSince.size > 0
        ? (latest: ProjectDocument[] | undefined) =>
            getPendingExtractionPollInterval(latest ?? [], pendingSince)
        : 0,
    [pendingSince],
  );

  const {
    data: documents,
    error,
    isLoading,
    mutate,
  } = useSWR<ProjectDocument[]>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: pollPendingExtraction
      ? pendingExtractionInterval
      : refreshInterval,
  });

  // Updated while rendering rather than in an effect, so no card renders a
  // pending document before its start time is known. `trackPendingSince`
  // returns the same map when nothing changed, which ends the re-render.
  const nextPendingSince = pollPendingExtraction
    ? trackPendingSince(pendingSince, documents)
    : NOTHING_PENDING;
  if (nextPendingSince !== pendingSince) {
    setPendingSince(nextPendingSince);
  }

  // Use the upload hook from turboplan-upload
  const {
    upload: uploadToBlob,
    isUploading,
    progress: uploadProgress,
    error: uploadError,
    reset: resetUpload,
  } = useFileUpload({
    maxSize: PROJECT_DOCUMENT_MAX_FILE_SIZE,
    allowedTypes: ALLOWED_MIME_TYPES,
  });

  /**
   * Upload a document and create the database record
   */
  const uploadDocument = useCallback(
    async (file: File) => {
      // Validate file type
      if (!isProjectDocumentMimeType(file.type)) {
        throw new Error(
          "File type not allowed. Only PDF and Word documents are supported.",
        );
      }

      // Validate file size
      if (file.size > PROJECT_DOCUMENT_MAX_FILE_SIZE) {
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
    pendingSince,
  };
}
