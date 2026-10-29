"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { withResolvedContentType } from "@wildfires-org/turboplan-upload/types";

import { useOrganizationDocuments } from "@/hooks/use-organization-documents";
import {
  createSerialQueue,
  getErrorMessage,
  getKnownDocumentKeys,
  getUploadTimeoutMessage,
  pruneImportedDocuments,
  withTimeout,
} from "@/lib/document-upload-queue";
import {
  isAtDocumentLimit,
  ORGANIZATION_DOCUMENTS_LIMIT_MESSAGE,
  type OrganizationDropPlanItem,
  type OrganizationDropRow,
  planOrganizationDrop,
} from "@/lib/organization-context";

type QueuedItem = OrganizationDropPlanItem<File> & { row: OrganizationDropRow };

// Generous: uploads and the API client set no limit of their own, and a hung
// upload would otherwise hold the queue until reload.
const DOCUMENT_UPLOAD_TIMEOUT_MS = 10 * 60_000;

// Waiting longer than this for the documents list (to check duplicates and
// the limit) uploads without the check rather than holding the queue.
const DOCUMENT_LIST_TIMEOUT_MS = 30_000;

/**
 * Drop handling for the Organization Context dropzone: plans each drop,
 * uploads the documents one at a time (skipping duplicates and stopping at
 * the document limit) and keeps a status row per file.
 *
 * It does not poll the list: the document list on the same page does (same
 * SWR entry).
 */
export const useOrganizationDocumentsDrop = (organizationId: string) => {
  const [rows, setRows] = useState<OrganizationDropRow[]>([]);
  const nextRowIdRef = useRef(0);

  const { documents, isLoading, uploadDocument, refreshDocuments } =
    useOrganizationDocuments({ organizationId });
  const documentsRef = useRef(documents);
  documentsRef.current = documents;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  const [queue] = useState(createSerialQueue);
  // Rows dismissed while waiting: their files are skipped when their turn
  // comes.
  const removedRowIdsRef = useRef(new Set<string>());
  // Name + size keys of files waiting in (or going through) the queue.
  const queuedKeysRef = useRef(new Set<string>());
  // Documents added this session that the cached list may not show yet, by
  // document id; forgotten once the list has them.
  const importedDocumentsRef = useRef<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    importedDocumentsRef.current = pruneImportedDocuments(
      importedDocumentsRef.current,
      documents,
    );
  }, [documents]);

  const updateRow = useCallback(
    (id: string, patch: Partial<OrganizationDropRow>) => {
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const removeRows = useCallback((ids: ReadonlySet<string>) => {
    for (const id of ids) {
      removedRowIdsRef.current.add(id);
    }
    setRows((current) => current.filter((row) => !ids.has(row.id)));
  }, []);

  // A drop made before the list has loaded waits for it, so its files are
  // still checked against the organization's documents.
  const loadDocuments = useCallback(async () => {
    if (!isLoadingRef.current) {
      return documentsRef.current;
    }
    try {
      return (
        (await withTimeout(
          refreshDocuments(),
          DOCUMENT_LIST_TIMEOUT_MS,
          "The documents list did not load",
        )) ?? documentsRef.current
      );
    } catch {
      // Best effort: upload without the check rather than not at all.
      return documentsRef.current;
    }
  }, [refreshDocuments]);

  const importItem = useCallback(
    async ({ row, file, dedupeKey }: QueuedItem) => {
      if (removedRowIdsRef.current.has(row.id)) {
        return;
      }

      // Checked again here, not only when planned: the list may have loaded
      // or changed since.
      const latestDocuments = await loadDocuments();
      const knownKeys = getKnownDocumentKeys(
        latestDocuments,
        importedDocumentsRef.current,
      );
      if (knownKeys.has(dedupeKey)) {
        updateRow(row.id, { phase: "duplicate" });
        return;
      }
      if (isAtDocumentLimit(latestDocuments, importedDocumentsRef.current)) {
        updateRow(row.id, {
          phase: "error",
          message: ORGANIZATION_DOCUMENTS_LIMIT_MESSAGE,
        });
        return;
      }

      updateRow(row.id, { phase: "uploading", progress: 0 });
      try {
        const document = await withTimeout(
          uploadDocument(file, (progress) => updateRow(row.id, { progress })),
          DOCUMENT_UPLOAD_TIMEOUT_MS,
          getUploadTimeoutMessage(DOCUMENT_UPLOAD_TIMEOUT_MS),
        );
        importedDocumentsRef.current = new Map(
          importedDocumentsRef.current,
        ).set(document.id, dedupeKey);
        updateRow(row.id, { phase: "added", progress: undefined });
      } catch (error) {
        updateRow(row.id, {
          phase: "error",
          progress: undefined,
          message: getErrorMessage(error, "Upload failed"),
        });
      }
    },
    [loadDocuments, updateRow, uploadDocument],
  );

  const handleDrop = useCallback(
    (droppedFiles: File[]) => {
      const files = droppedFiles.map(withResolvedContentType);
      const blockedKeys = getKnownDocumentKeys(
        documentsRef.current,
        importedDocumentsRef.current,
      );
      for (const key of queuedKeysRef.current) {
        blockedKeys.add(key);
      }

      const items = planOrganizationDrop(files, blockedKeys).map(
        (item): QueuedItem => {
          nextRowIdRef.current += 1;
          return {
            ...item,
            row: {
              id: `organization-drop-${nextRowIdRef.current}`,
              name: item.file.name,
              phase: item.phase,
              message: item.message,
            },
          };
        },
      );

      setRows((current) => [...items.map(({ row }) => row), ...current]);

      for (const item of items) {
        if (item.phase !== "queued") {
          continue;
        }
        queuedKeysRef.current.add(item.dedupeKey);
        void queue
          .run(() => importItem(item))
          .catch((error: unknown) => {
            // Outside the expected failures: never leave a row spinning.
            updateRow(item.row.id, {
              phase: "error",
              progress: undefined,
              message: getErrorMessage(
                error,
                "Something went wrong. Try again.",
              ),
            });
          })
          .finally(() => {
            queuedKeysRef.current.delete(item.dedupeKey);
          });
      }
    },
    [importItem, queue, updateRow],
  );

  return {
    rows,
    documentCount: documents.length,
    isLoading,
    handleDrop,
    removeRows,
  };
};
