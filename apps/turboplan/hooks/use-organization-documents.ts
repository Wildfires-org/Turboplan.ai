"use client";

import { useCallback, useMemo, useState } from "react";

import useSWR from "swr";

import {
  ApiClient,
  deleteFetcher,
  fetcher,
  patchFetcher,
} from "@wildfires-org/turboplan-api-client";
import {
  getPendingExtractionPollInterval,
  trackPendingSince,
} from "@wildfires-org/turboplan-documents/types";
import { UploadClient } from "@wildfires-org/turboplan-upload/client";
import {
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
  PROJECT_DOCUMENT_MIME_TYPES,
} from "@wildfires-org/turboplan-upload/types";

import {
  ORGANIZATION_DOCUMENTS_LIMIT_CODE,
  ORGANIZATION_DOCUMENTS_LIMIT_MESSAGE,
  sortOrganizationDocuments,
} from "@/lib/organization-context";
import type {
  OrganizationDocument,
  OrganizationDocumentsResponse,
} from "@/types/organization-context";

type UseOrganizationDocumentsOptions = {
  organizationId: string;
  /**
   * Poll while any document waits for processing, on the project documents'
   * schedule (fast while fresh, slow once stale, then stop). Enable it on one
   * user of the list per page: every caller shares the same SWR entry.
   */
  pollPendingExtraction?: boolean;
};

const DOCUMENTS_ENDPOINT = "/api/organization-documents";

const ALLOWED_MIME_TYPES = Object.keys(PROJECT_DOCUMENT_MIME_TYPES);

const NOTHING_PENDING: ReadonlyMap<string, number> = new Map();

const apiClient = new ApiClient();

export const getOrganizationDocumentsKey = (organizationId: string) =>
  `${DOCUMENTS_ENDPOINT}?organizationId=${encodeURIComponent(organizationId)}`;

const getDocumentUrl = (documentId: string) =>
  `${DOCUMENTS_ENDPOINT}/${documentId}`;

const replaceDocument = (
  current: OrganizationDocumentsResponse | undefined,
  documentId: string,
  patch: Partial<OrganizationDocument>,
): OrganizationDocumentsResponse => ({
  documents: (current?.documents ?? []).map((document) =>
    document.id === documentId ? { ...document, ...patch } : document,
  ),
});

const removeDocument = (
  current: OrganizationDocumentsResponse | undefined,
  documentId: string,
): OrganizationDocumentsResponse => ({
  documents: (current?.documents ?? []).filter(
    (document) => document.id !== documentId,
  ),
});

/**
 * An organization's reference documents, key documents first then newest
 * (the order the AI reads them in), with upload and optimistic pin, rename
 * and delete. Pin, rename and delete resolve once the list shows the
 * server's state again, and roll back and rethrow on failure.
 */
export const useOrganizationDocuments = ({
  organizationId,
  pollPendingExtraction = false,
}: UseOrganizationDocumentsOptions) => {
  const key = getOrganizationDocumentsKey(organizationId);

  // When this client first saw each document pending, so a skewed server
  // clock cannot stretch or cut the polling schedule (as for project docs).
  const [pendingSince, setPendingSince] =
    useState<ReadonlyMap<string, number>>(NOTHING_PENDING);

  // A new function per set of pending documents restarts SWR's poll timer
  // whenever that set changes (see useProjectDocuments).
  const pendingExtractionInterval = useMemo(
    () =>
      pendingSince.size > 0
        ? (latest: OrganizationDocumentsResponse | undefined) =>
            getPendingExtractionPollInterval(
              latest?.documents ?? [],
              pendingSince,
            )
        : 0,
    [pendingSince],
  );

  const { data, error, isLoading, mutate } =
    useSWR<OrganizationDocumentsResponse>(key, fetcher, {
      revalidateOnFocus: false,
      refreshInterval: pollPendingExtraction ? pendingExtractionInterval : 0,
    });

  // Updated while rendering so no row renders a pending document before its
  // start time is known; the same map comes back when nothing changed.
  const nextPendingSince = pollPendingExtraction
    ? trackPendingSince(pendingSince, data?.documents)
    : NOTHING_PENDING;
  if (nextPendingSince !== pendingSince) {
    setPendingSince(nextPendingSince);
  }

  const documents = useMemo(
    () => sortOrganizationDocuments(data?.documents ?? []),
    [data],
  );

  /** Uploads a file to storage, then registers it with the organization. */
  const uploadDocument = useCallback(
    async (file: File, onProgress?: (percent: number) => void) => {
      const uploadResult = await new UploadClient().upload(file, {
        maxSize: PROJECT_DOCUMENT_MAX_FILE_SIZE,
        allowedTypes: ALLOWED_MIME_TYPES,
        onProgress,
      });

      const {
        data: created,
        error: apiError,
        code,
      } = await apiClient.post<OrganizationDocument>(DOCUMENTS_ENDPOINT, {
        organizationId,
        filename: uploadResult.pathname.split("/").pop() || file.name,
        originalFilename: file.name,
        mimeType: file.type,
        size: file.size,
        url: uploadResult.url,
      });

      if (code === ORGANIZATION_DOCUMENTS_LIMIT_CODE) {
        // Someone else may have added documents: show the real count.
        void mutate();
        throw new Error(ORGANIZATION_DOCUMENTS_LIMIT_MESSAGE);
      }
      if (apiError || !created) {
        throw new Error(apiError ?? "The document could not be saved");
      }

      await mutate(
        (current) => ({
          documents: [
            created,
            ...(current?.documents ?? []).filter(
              (document) => document.id !== created.id,
            ),
          ],
        }),
        { revalidate: true },
      );

      return created;
    },
    [organizationId, mutate],
  );

  // Shows `optimistic` at once (applied to what is on screen, so overlapping
  // edits stack), then refetches however `request` ends: success confirms
  // the change, failure rolls it back, and anything another mutation or poll
  // put on screen meanwhile is corrected. The refetch always runs, so the
  // list always ends on the server's state; failures are rethrown.
  // (Not SWR's `optimisticData`: a mutation superseded by a newer one skips
  // both its rollback and its revalidation.)
  const mutateOptimistically = useCallback(
    async (
      request: () => Promise<unknown>,
      optimistic: (
        current: OrganizationDocumentsResponse | undefined,
      ) => OrganizationDocumentsResponse,
    ) => {
      await mutate(optimistic, { revalidate: false });
      try {
        await request();
      } finally {
        await mutate();
      }
    },
    [mutate],
  );

  const setPinned = useCallback(
    (documentId: string, isPinned: boolean) =>
      mutateOptimistically(
        () =>
          patchFetcher<OrganizationDocument>(getDocumentUrl(documentId), {
            arg: { isPinned },
          }),
        (current) => replaceDocument(current, documentId, { isPinned }),
      ),
    [mutateOptimistically],
  );

  /** The API keeps the original extension whatever `newName` ends with. */
  const renameDocument = useCallback(
    (documentId: string, newName: string) =>
      mutateOptimistically(
        () =>
          patchFetcher<OrganizationDocument>(getDocumentUrl(documentId), {
            arg: { originalFilename: newName },
          }),
        (current) =>
          replaceDocument(current, documentId, { originalFilename: newName }),
      ),
    [mutateOptimistically],
  );

  const deleteDocument = useCallback(
    (documentId: string) =>
      mutateOptimistically(
        () => deleteFetcher(DOCUMENTS_ENDPOINT, { arg: documentId }),
        (current) => removeDocument(current, documentId),
      ),
    [mutateOptimistically],
  );

  const refreshDocuments = useCallback(async () => {
    const latest = await mutate();
    return latest?.documents;
  }, [mutate]);

  return {
    documents,
    isLoading,
    hasError: Boolean(error),
    pendingSince,
    uploadDocument,
    setPinned,
    renameDocument,
    deleteDocument,
    refreshDocuments,
  };
};
