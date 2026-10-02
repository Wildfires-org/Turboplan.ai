"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useProjectDocuments } from "@wildfires-org/turboplan-documents/client";
import { processAndSaveGisFile } from "@wildfires-org/turboplan-map/client";
import { useFileUpload } from "@wildfires-org/turboplan-upload/client";
import {
  GIS_MAX_FILE_SIZE,
  GIS_UPLOAD_CONTENT_TYPES,
  withResolvedContentType,
} from "@wildfires-org/turboplan-upload/types";

import {
  createSerialQueue,
  type DropFlags,
  type DropImportOptions,
  type DropRow,
  failUnfinishedRows,
  getKnownDocumentKeys,
  getNextStaleDelay,
  importDropItems,
  planDrop,
  projectGisSaveQueue,
  pruneImportedDocuments,
  type QueuedDropItem,
  withTimeout,
} from "@/lib/project-context-drop";

type UseProjectContextDropOptions = DropFlags & {
  projectId: string;
};

// Upload types, not the dropped types: KML goes up as text/plain.
const GIS_ALLOWED_TYPES = [...GIS_UPLOAD_CONTENT_TYPES];

// Waiting longer than this for the documents list (to check duplicates)
// uploads without the check rather than holding the queue.
const DOCUMENT_LIST_TIMEOUT_MS = 30_000;

/**
 * Drop handling for the Project Context dropzone: plans each drop, imports
 * documents and GIS files through their own serial queues (see
 * `importDropItems`) and keeps a status row per file.
 *
 * It does not poll the documents list itself: on the Project Context page
 * the documents section polls that same list (same SWR key) while any
 * document waits for its text, which updates these rows too.
 */
export const useProjectContextDrop = ({
  projectId,
  acceptsDocuments,
  acceptsGisLayers,
}: UseProjectContextDropOptions) => {
  const [rows, setRows] = useState<DropRow[]>([]);
  const nextRowIdRef = useRef(0);

  const { documents, isLoading, uploadDocument, refreshDocuments } =
    useProjectDocuments({ projectId, source: "upload" });
  const documentsRef = useRef(documents);
  documentsRef.current = documents;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  // Staleness is time-based: re-render when the next pending row goes stale
  // so it swaps its spinner for the static "waiting" state.
  const [, setStaleTick] = useState(0);
  const nextStaleDelay = getNextStaleDelay(rows, documents);
  useEffect(() => {
    if (nextStaleDelay === null) {
      return;
    }
    const timer = setTimeout(
      () => setStaleTick((tick) => tick + 1),
      nextStaleDelay,
    );
    return () => clearTimeout(timer);
  }, [nextStaleDelay]);

  const { upload: uploadToStorage } = useFileUpload({
    maxSize: GIS_MAX_FILE_SIZE,
    allowedTypes: GIS_ALLOWED_TYPES,
  });

  const [documentQueue] = useState(createSerialQueue);
  // Rows dismissed while waiting: their files are skipped when their turn
  // comes.
  const removedRowIdsRef = useRef(new Set<string>());
  // Documents imported this session that the cached list may not show yet,
  // by document id. Forgotten once the list has them (see
  // pruneImportedDocuments), so a document deleted later can be re-added.
  const importedDocumentsRef = useRef<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    importedDocumentsRef.current = pruneImportedDocuments(
      importedDocumentsRef.current,
      documents,
    );
  }, [documents]);

  const updateRow = useCallback((id: string, patch: Partial<DropRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }, []);

  const failRow = useCallback((id: string, message: string) => {
    setRows((current) => failUnfinishedRows(current, new Set([id]), message));
  }, []);

  const removeRows = useCallback((ids: ReadonlySet<string>) => {
    for (const id of ids) {
      removedRowIdsRef.current.add(id);
    }
    setRows((current) => current.filter((row) => !ids.has(row.id)));
  }, []);

  // A drop made before the list has loaded waits for it, so its documents
  // are still checked against the project's.
  const loadKnownDocumentKeys = useCallback(async () => {
    let latestDocuments = documentsRef.current;
    if (isLoadingRef.current) {
      try {
        latestDocuments =
          (await withTimeout(
            refreshDocuments(),
            DOCUMENT_LIST_TIMEOUT_MS,
            "The documents list did not load",
          )) ?? latestDocuments;
      } catch {
        // Best effort: upload without the check rather than not at all.
      }
    }
    return getKnownDocumentKeys(latestDocuments, importedDocumentsRef.current);
  }, [refreshDocuments]);

  const handleDrop = useCallback(
    (droppedFiles: File[]) => {
      const files = droppedFiles.map(withResolvedContentType);
      const knownKeys = getKnownDocumentKeys(
        documentsRef.current,
        importedDocumentsRef.current,
      );
      const items = planDrop(files, knownKeys, {
        acceptsDocuments,
        acceptsGisLayers,
      }).map((item): QueuedDropItem<File> => {
        nextRowIdRef.current += 1;
        return {
          ...item,
          row: {
            id: `drop-${nextRowIdRef.current}`,
            name: item.name,
            kind: item.kind,
            mimeType: item.file.type,
            phase: item.phase,
            message: item.message,
          },
        };
      });

      setRows((current) => [...items.map(({ row }) => row), ...current]);

      const options: DropImportOptions<File> = {
        documentQueue,
        gisQueue: {
          run: (task) => projectGisSaveQueue.run(projectId, task),
        },
        updateRow,
        failRow,
        isRowRemoved: (id) => removedRowIdsRef.current.has(id),
        loadKnownDocumentKeys,
        uploadDocument,
        onDocumentImported: (documentId, key) => {
          importedDocumentsRef.current = new Map(
            importedDocumentsRef.current,
          ).set(documentId, key);
        },
        uploadGisFile: uploadToStorage,
        saveGisLayers: (file, url) =>
          processAndSaveGisFile({ projectId, url, fileName: file.name }),
      };
      void importDropItems(items, options);
    },
    [
      acceptsDocuments,
      acceptsGisLayers,
      documentQueue,
      failRow,
      loadKnownDocumentKeys,
      projectId,
      updateRow,
      uploadDocument,
      uploadToStorage,
    ],
  );

  return { rows, documents, handleDrop, removeRows };
};
