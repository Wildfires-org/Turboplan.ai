/**
 * Uploader information for a project document
 */
export interface ProjectDocumentUploader {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Origin of a project document. "upload" for manual/chat uploads (Documents
 * page), "research" for research-agent results (Context page).
 */
export type ProjectDocumentSource = "upload" | "research";

/**
 * Text extraction lifecycle: "pending" until the extraction worker runs, then
 * "done", "failed" (see `extractionError`) or "unsupported".
 */
export type ProjectDocumentExtractionStatus =
  | "pending"
  | "done"
  | "failed"
  | "unsupported";

/** Extracted text of a project document (GET /api/project-documents/:id/text). */
export type ProjectDocumentText = {
  status: ProjectDocumentExtractionStatus;
  text: string | null;
  error: string | null;
};

/**
 * A document still "pending" this long after upload is not being extracted
 * right now (the extraction worker is down or busy). The UI stops showing a
 * spinner and polls for it only slowly from then on.
 */
export const EXTRACTION_STALE_AFTER_MS = 2 * 60 * 1000;

/**
 * Poll the documents list this often while a pending document is fresh; the
 * extraction worker picks new documents up within a few seconds.
 */
export const EXTRACTION_POLL_INTERVAL_MS = 4000;

/** Poll this often once a pending document has gone stale. */
export const EXTRACTION_SLOW_POLL_INTERVAL_MS = 30_000;

/** Stop polling for a document this client has seen pending this long. */
export const EXTRACTION_POLL_TIMEOUT_MS = 15 * 60 * 1000;

type ExtractionTiming = {
  extractionStatus?: ProjectDocumentExtractionStatus;
  createdAt: string;
};

type ExtractionState = {
  id: string;
  extractionStatus?: ProjectDocumentExtractionStatus;
};

/**
 * How long ago a document was created, by the client clock, or null when
 * `createdAt` does not parse. `createdAt` comes from the server clock, so the
 * age is clamped at 0: a server clock running ahead cannot make it negative.
 */
export const getExtractionAgeMs = (
  createdAt: string,
  now: number = Date.now(),
): number | null => {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) {
    return null;
  }
  return Math.max(0, now - created);
};

/**
 * Milliseconds until a document pending since `since` (epoch ms) counts as
 * stale: 0 once it does, Infinity when `since` is NaN. Never more than
 * {@link EXTRACTION_STALE_AFTER_MS}, so a `since` in the future cannot
 * stretch the wait.
 */
export const getMsUntilStale = (
  since: number,
  now: number = Date.now(),
): number => {
  if (Number.isNaN(since)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, EXTRACTION_STALE_AFTER_MS - Math.max(0, now - since));
};

/**
 * {@link getMsUntilStale} measured from the server's `createdAt`. Prefer a
 * client-side start time where there is one: the two clocks can disagree.
 */
export const getMsUntilExtractionStale = (
  createdAt: string,
  now: number = Date.now(),
): number => {
  return getMsUntilStale(Date.parse(createdAt), now);
};

/**
 * Poll interval for a document that has been pending for `ageMs`: fast while
 * fresh, slow once stale, 0 (stop) after {@link EXTRACTION_POLL_TIMEOUT_MS}.
 */
export const getExtractionPollIntervalForAge = (ageMs: number): number => {
  if (ageMs < EXTRACTION_STALE_AFTER_MS) {
    return EXTRACTION_POLL_INTERVAL_MS;
  }
  if (ageMs < EXTRACTION_POLL_TIMEOUT_MS) {
    return EXTRACTION_SLOW_POLL_INTERVAL_MS;
  }
  return 0;
};

/**
 * When this client first saw each listed document pending: keeps the times
 * of documents still pending, stamps newly pending ones with `now` and drops
 * the rest. Returns `previous` itself when the pending set is unchanged.
 */
export const trackPendingSince = (
  previous: ReadonlyMap<string, number>,
  documents: ExtractionState[] | undefined,
  now: number = Date.now(),
): ReadonlyMap<string, number> => {
  const next = new Map<string, number>();
  for (const document of documents ?? []) {
    if (document.extractionStatus === "pending") {
      next.set(document.id, previous.get(document.id) ?? now);
    }
  }
  const isUnchanged =
    next.size === previous.size &&
    Array.from(next.keys()).every((id) => previous.has(id));
  return isUnchanged ? previous : next;
};

/**
 * Poll interval for a documents list: the shortest interval any pending
 * document needs, 0 when none does. Ages run from `pendingSince` (see
 * {@link trackPendingSince}), not the server's `createdAt`, so server clock
 * skew cannot stretch or cut the schedule; a document missing from it counts
 * as just seen.
 */
export const getPendingExtractionPollInterval = (
  documents: ExtractionState[],
  pendingSince: ReadonlyMap<string, number>,
  now: number = Date.now(),
): number => {
  let interval = 0;
  for (const document of documents) {
    if (document.extractionStatus !== "pending") {
      continue;
    }
    const since = pendingSince.get(document.id) ?? now;
    const documentInterval = getExtractionPollIntervalForAge(
      Math.max(0, now - since),
    );
    if (documentInterval > 0) {
      interval =
        interval === 0
          ? documentInterval
          : Math.min(interval, documentInterval);
    }
  }
  return interval;
};

/** Pending for longer than {@link EXTRACTION_STALE_AFTER_MS}. */
export const isExtractionStale = (
  document: ExtractionTiming,
  now: number = Date.now(),
): boolean => {
  return (
    document.extractionStatus === "pending" &&
    getMsUntilExtractionStale(document.createdAt, now) === 0
  );
};

/**
 * Project document data structure
 */
export interface ProjectDocument {
  id: string;
  projectId: string;
  userId: string | null;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  url: string;
  source: ProjectDocumentSource;
  folder?: string | null;
  folderDescription?: string | null;
  extractionStatus?: ProjectDocumentExtractionStatus;
  extractionError?: string | null;
  createdAt: string;
  uploader: ProjectDocumentUploader | null;
}

/**
 * Options for the useProjectDocuments hook
 */
export interface UseProjectDocumentsOptions {
  projectId: string;
  /** Only fetch documents of this origin. Omit to fetch all. */
  source?: ProjectDocumentSource;
  /**
   * Poll the list every N ms (0 or omitted: no polling). A function receives
   * the latest list and is re-evaluated after every poll. Keep a function
   * stable between renders: SWR restarts its poll timer whenever it changes.
   */
  refreshInterval?:
    | number
    | ((documents: ProjectDocument[] | undefined) => number);
  /**
   * Poll while any listed document waits for its text, on the
   * {@link getExtractionPollIntervalForAge} schedule, timed from when this
   * client first saw it pending. Overrides `refreshInterval`.
   */
  pollPendingExtraction?: boolean;
}

/**
 * Return type for the useProjectDocuments hook
 */
export interface UseProjectDocumentsReturn {
  documents: ProjectDocument[];
  isLoading: boolean;
  error: string | null;
  uploadDocument: (file: File) => Promise<ProjectDocument | undefined>;
  deleteDocument: (documentId: string) => Promise<void>;
  renameDocument: (documentId: string, newName: string) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: Error | null;
  resetUpload: () => void;
  isDeleting: string | null;
  isRenaming: string | null;
  refreshDocuments: () => Promise<ProjectDocument[] | undefined>;
  /**
   * With `pollPendingExtraction`: when this client first saw each pending
   * document pending (epoch ms, by document id). Empty otherwise.
   */
  pendingSince: ReadonlyMap<string, number>;
}
