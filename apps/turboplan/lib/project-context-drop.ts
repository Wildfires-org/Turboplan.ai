import {
  EXTRACTION_STALE_AFTER_MS,
  getExtractionAgeMs,
  type ProjectDocumentExtractionStatus,
} from "@wildfires-org/turboplan-documents/types";
import {
  formatSkippedLayersMessage,
  type GisZipSaveResult,
} from "@wildfires-org/turboplan-map/client";
import {
  classifyProjectFile,
  getProjectFileMaxSize,
  isShapefilePart,
  type ProjectFileKind,
  SHAPEFILE_PART_MESSAGE,
} from "@wildfires-org/turboplan-upload/types";

// Logic for the Project Context dropzone (and the GIS saves the project chat
// shares with it), kept free of React so it can be unit tested: planning a
// drop, importing it through serial queues with timeouts, and the status of
// each row.

export type DropRowPhase =
  | "queued"
  | "uploading"
  | "processing"
  | "registered"
  | "done"
  | "duplicate"
  | "error";

export type DropRow = {
  id: string;
  name: string;
  kind: ProjectFileKind;
  phase: DropRowPhase;
  /** Result or error text for "done" / "error" rows */
  message?: string;
  /** Content type the file is uploaded with */
  mimeType?: string;
  /** Set once a document row is registered with the project */
  documentId?: string;
  /**
   * Client clock time the document was registered. Extraction waits are
   * measured from it, not from the server's `createdAt`, so a skewed server
   * clock cannot end (or stretch) the wait early.
   */
  registeredAt?: number;
};

export type DropRowTone =
  | "progress"
  | "success"
  | "neutral"
  | "warning"
  | "error";

export type DropRowStatus = {
  label: string;
  tone: DropRowTone;
  detail?: string;
  isFinished: boolean;
  /** Finished, or still waiting its turn (dismissing takes it off the queue) */
  isDismissable: boolean;
};

type DocumentExtraction = {
  id: string;
  extractionStatus?: ProjectDocumentExtractionStatus;
  extractionError?: string | null;
  createdAt: string;
};

/** Which modules take dropped files; both resolved on the server. */
export type DropFlags = {
  /** Documents module enabled: PDF / Word files */
  acceptsDocuments: boolean;
  /** Map module enabled: GIS files */
  acceptsGisLayers: boolean;
};

type DropFile = {
  name: string;
  size: number;
  type: string;
};

export type DropPlanItem<TFile extends DropFile> = {
  file: TFile;
  /** Row title: the file name, or every name of a collapsed shapefile set */
  name: string;
  kind: ProjectFileKind;
  /** Rejected ("error"), already in the project ("duplicate") or "queued" */
  phase: Extract<DropRowPhase, "queued" | "duplicate" | "error">;
  /** Rejection reason of an "error" item */
  message?: string;
  /** Name + size key of a document, re-checked right before it uploads */
  dedupeKey?: string;
};

type ListedDocument = {
  id: string;
  originalFilename: string;
  size: number;
};

const MB = 1024 * 1024;
const MINUTE = 60_000;

const DOCUMENT_EXTENSION_PATTERN = /\.(pdf|docx?)$/i;
const SENTENCE_END_PATTERN = /[.!?]$/;

const IN_PROGRESS_PHASES: ReadonlySet<DropRowPhase> = new Set([
  "queued",
  "uploading",
  "processing",
]);

// ---------------------------------------------------------------------------
// Formatting

/** Duplicate key for a document: file name + size, as the chat input uses. */
export const getDocumentDedupeKey = (name: string, size: number) =>
  `${name}:${size}`;

export const formatMegabytes = (bytes: number) => `${Math.round(bytes / MB)}MB`;

const formatDuration = (ms: number) => {
  if (ms >= MINUTE) {
    const minutes = Math.round(ms / MINUTE);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const seconds = Math.max(1, Math.round(ms / 1000));
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
};

/** Joins messages into sentences, ending each with a full stop if needed. */
export const joinSentences = (parts: Array<string | null | undefined>) =>
  parts
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => {
      const text = part.trim();
      return SENTENCE_END_PATTERN.test(text) ? text : `${text}.`;
    })
    .join(" ");

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error && error.message ? error.message : fallback;
};

/** Short type label shown under the file name. */
export const getDropRowTypeLabel = (
  row: Pick<DropRow, "name" | "kind" | "mimeType">,
) => {
  if (row.kind === "gis") {
    const dotIndex = row.name.lastIndexOf(".");
    return dotIndex > 0
      ? `GIS layers (${row.name.slice(dotIndex).toLowerCase()})`
      : "GIS layers";
  }
  if (row.kind === "unsupported") {
    return "Unsupported file";
  }
  // The extension decides, as it does for classification; a document
  // recognised by its MIME type alone is labelled from that.
  const isPdf = DOCUMENT_EXTENSION_PATTERN.test(row.name)
    ? row.name.toLowerCase().endsWith(".pdf")
    : row.mimeType === "application/pdf";
  return isPdf ? "PDF" : "Word document";
};

/**
 * Which layers of a saved GIS file were already in the project, and how to
 * replace them; null when none were.
 */
export const formatSkippedLayers = (result: GisZipSaveResult) => {
  if (result.skipped === 0) {
    return null;
  }
  const names = result.skippedLayerNames ?? [];
  if (names.length > 0) {
    return formatSkippedLayersMessage(names);
  }
  return `${result.skipped} already in the project (delete ${result.skipped === 1 ? "it" : "them"} first to replace)`;
};

/**
 * What saving a GIS file did: layers added or not saved, then which were
 * already in the project and how to replace them.
 */
export const formatGisResult = (result: GisZipSaveResult): string => {
  const counts: string[] = [];
  if (result.added > 0) {
    counts.push(
      `${result.added} layer${result.added === 1 ? "" : "s"} added to the map`,
    );
  }
  if (result.failed > 0) {
    counts.push(`${result.failed} could not be saved`);
  }
  const summary = counts.length > 0 ? counts.join(", ") : null;
  const skipped = formatSkippedLayers(result);
  if (!summary && !skipped) {
    return "No layers added";
  }
  return joinSentences([summary, skipped]);
};

/**
 * Full message for a finished GIS row: {@link formatGisResult}, the first
 * layer error, and any notes from the save (e.g. features it dropped).
 */
export const getGisResultMessage = (result: GisZipSaveResult): string => {
  return joinSentences([
    formatGisResult(result),
    result.errors[0],
    ...(result.warnings ?? []),
  ]);
};

/**
 * Tone for a finished GIS row: success when something was added (or was
 * already there), an error when nothing was saved and some layers failed.
 */
export const getGisResultPhase = (
  result: GisZipSaveResult,
): Extract<DropRowPhase, "done" | "error"> => {
  if (result.added === 0 && result.skipped === 0) {
    return "error";
  }
  return "done";
};

// ---------------------------------------------------------------------------
// Planning a drop

/** Why a dropped file is not imported, or null when it is. */
const getDropRejection = (
  file: DropFile,
  kind: ProjectFileKind,
  flags: DropFlags,
): string | null => {
  if (kind === "unsupported") {
    if (isShapefilePart(file)) {
      return flags.acceptsGisLayers
        ? SHAPEFILE_PART_MESSAGE
        : "Map layers are not enabled for this project";
    }
    return "Unsupported file type";
  }
  if (kind === "document" && !flags.acceptsDocuments) {
    return "Documents are not enabled for this project";
  }
  if (kind === "gis" && !flags.acceptsGisLayers) {
    return "Map layers are not enabled for this project";
  }
  if (file.size === 0) {
    return "The file is empty (0 bytes)";
  }
  const maxSize = getProjectFileMaxSize(kind);
  if (maxSize && file.size > maxSize) {
    return kind === "gis"
      ? `GIS file too large, max ${formatMegabytes(maxSize)}`
      : `File too large, max ${formatMegabytes(maxSize)}`;
  }
  return null;
};

/** A shapefile's parts share their base name: roads.shp, roads.dbf, … */
const getShapefileSetKey = (name: string) => {
  const dotIndex = name.lastIndexOf(".");
  return (dotIndex > 0 ? name.slice(0, dotIndex) : name).toLowerCase();
};

const planFile = <TFile extends DropFile>(
  file: TFile,
  existingKeys: ReadonlySet<string>,
  flags: DropFlags,
): DropPlanItem<TFile> => {
  const kind = classifyProjectFile(file);
  const rejection = getDropRejection(file, kind, flags);
  if (rejection) {
    return { file, name: file.name, kind, phase: "error", message: rejection };
  }
  if (kind !== "document") {
    return { file, name: file.name, kind, phase: "queued" };
  }
  const dedupeKey = getDocumentDedupeKey(file.name, file.size);
  return {
    file,
    name: file.name,
    kind,
    dedupeKey,
    phase: existingKeys.has(dedupeKey) ? "duplicate" : "queued",
  };
};

/**
 * What happens to each dropped file, in drop order: rejected, skipped as a
 * document already in the project (same name + size as one of
 * `existingKeys`), or queued for import. Loose parts of one shapefile share a
 * single rejected item. Two copies of one new document are both queued: the
 * importer skips the second only once the first has been added, so a failed
 * first upload does not block the second.
 */
export const planDrop = <TFile extends DropFile>(
  files: TFile[],
  existingKeys: ReadonlySet<string>,
  flags: DropFlags,
): DropPlanItem<TFile>[] => {
  const plan: DropPlanItem<TFile>[] = [];
  const shapefileSets = new Map<string, DropPlanItem<TFile>>();

  for (const file of files) {
    if (!isShapefilePart(file)) {
      plan.push(planFile(file, existingKeys, flags));
      continue;
    }
    const setKey = getShapefileSetKey(file.name);
    const set = shapefileSets.get(setKey);
    if (set) {
      set.name = `${set.name}, ${file.name}`;
      continue;
    }
    const item = planFile(file, existingKeys, flags);
    shapefileSets.set(setKey, item);
    plan.push(item);
  }

  return plan;
};

// ---------------------------------------------------------------------------
// Duplicate documents

/**
 * Name + size keys of the project's documents: those in the cached list, plus
 * documents imported this session that the list does not show yet (it can
 * lag a render behind an upload). `imported` maps document id to key.
 */
export const getKnownDocumentKeys = (
  documents: ListedDocument[],
  imported: ReadonlyMap<string, string>,
): Set<string> => {
  const keys = new Set<string>();
  const listedIds = new Set<string>();
  for (const document of documents) {
    keys.add(getDocumentDedupeKey(document.originalFilename, document.size));
    listedIds.add(document.id);
  }
  for (const [documentId, key] of imported) {
    if (!listedIds.has(documentId)) {
      keys.add(key);
    }
  }
  return keys;
};

/**
 * Forgets imported documents the cached list has caught up with: from then
 * on the list alone says whether they are in the project, so one deleted
 * later can be dropped again. Returns `imported` itself when unchanged.
 */
export const pruneImportedDocuments = (
  imported: ReadonlyMap<string, string>,
  documents: Pick<ListedDocument, "id">[],
): ReadonlyMap<string, string> => {
  const listedIds = new Set(documents.map((document) => document.id));
  const remaining = new Map(
    Array.from(imported).filter(([documentId]) => !listedIds.has(documentId)),
  );
  return remaining.size === imported.size ? imported : remaining;
};

// ---------------------------------------------------------------------------
// Queues and timeouts

export type SerialQueue = {
  run: <T>(task: () => Promise<T>) => Promise<T>;
};

/**
 * Runs tasks one after another, in the order they were added. A failing task
 * rejects its own promise but does not stop the tasks after it.
 */
export const createSerialQueue = (): SerialQueue => {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run: (task) => {
      const result = tail.then(task);
      tail = result.catch(() => undefined);
      return result;
    },
  };
};

/** One {@link createSerialQueue} per key; different keys run side by side. */
export const createKeyedSerialQueue = () => {
  const queues = new Map<string, SerialQueue>();
  return {
    run: <T>(key: string, task: () => Promise<T>): Promise<T> => {
      let queue = queues.get(key);
      if (!queue) {
        queue = createSerialQueue();
        queues.set(key, queue);
      }
      return queue.run(task);
    },
  };
};

/**
 * GIS saves per project, shared by the Project Context dropzone and every
 * chat input (main chat and artifact panel): parallel saves race the map's
 * existing-layer lookup and can add the same layer twice.
 */
export const projectGisSaveQueue = createKeyedSerialQueue();

/** Rejects with `message` when `promise` takes longer than `ms`. */
export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
};

export type DropTimeouts = {
  /** Document upload and registration */
  documentUpload: number;
  /** GIS file upload to storage */
  gisUpload: number;
  /** Reading a stored GIS file and saving its layers */
  gisProcessing: number;
};

/**
 * Generous limits: uploads, the API client and the map service set none of
 * their own, and a hung step would otherwise hold its queue until reload.
 */
export const DROP_TIMEOUTS: DropTimeouts = {
  documentUpload: 10 * MINUTE,
  gisUpload: 10 * MINUTE,
  gisProcessing: 5 * MINUTE,
};

export const getUploadTimeoutMessage = (ms: number) =>
  `Upload timed out after ${formatDuration(ms)}`;

export const getGisProcessingTimeoutMessage = (ms: number) =>
  `Reading the GIS layers timed out after ${formatDuration(ms)}`;

// ---------------------------------------------------------------------------
// Importing a drop

export type QueuedDropItem<TFile extends DropFile> = DropPlanItem<TFile> & {
  row: DropRow;
};

export type DropImportOptions<TFile extends DropFile> = {
  /**
   * Documents, one at a time: a copy dropped again waits for the first and
   * is skipped once that one is in the project.
   */
  documentQueue: SerialQueue;
  /** GIS files, one at a time per project (see {@link projectGisSaveQueue}) */
  gisQueue: SerialQueue;
  updateRow: (id: string, patch: Partial<DropRow>) => void;
  /** Marks a row failed unless it already finished */
  failRow: (id: string, message: string) => void;
  /** True for a row dismissed while it waited; its file is skipped */
  isRowRemoved: (id: string) => boolean;
  /** Keys of the documents already in the project (see getKnownDocumentKeys) */
  loadKnownDocumentKeys: () => Promise<ReadonlySet<string>>;
  /** Uploads and registers a document */
  uploadDocument: (file: TFile) => Promise<{ id: string } | undefined>;
  onDocumentImported: (documentId: string, key: string) => void;
  /** Puts a GIS file in storage */
  uploadGisFile: (file: TFile) => Promise<{ url: string }>;
  /** Reads a stored GIS file and saves its layers to the project map */
  saveGisLayers: (file: TFile, url: string) => Promise<GisZipSaveResult>;
  timeouts?: Partial<DropTimeouts>;
  now?: () => number;
};

/**
 * Imports the queued items of a planned drop: documents through the document
 * queue, GIS files through the GIS queue, each step under a timeout, keeping
 * every item's row up to date. Resolves once all of them have finished.
 */
export const importDropItems = async <TFile extends DropFile>(
  items: QueuedDropItem<TFile>[],
  options: DropImportOptions<TFile>,
): Promise<void> => {
  const timeouts = { ...DROP_TIMEOUTS, ...options.timeouts };
  const now = options.now ?? Date.now;
  const { updateRow } = options;

  const importDocument = async ({
    row,
    file,
    dedupeKey,
  }: QueuedDropItem<TFile>) => {
    // Checked again here, not only when planned: an earlier copy of this
    // file may have been added since.
    const key = dedupeKey ?? getDocumentDedupeKey(file.name, file.size);
    const knownKeys = await options.loadKnownDocumentKeys();
    if (knownKeys.has(key)) {
      updateRow(row.id, { phase: "duplicate" });
      return;
    }

    updateRow(row.id, { phase: "uploading" });
    try {
      const document = await withTimeout(
        options.uploadDocument(file),
        timeouts.documentUpload,
        getUploadTimeoutMessage(timeouts.documentUpload),
      );
      if (!document) {
        throw new Error("The document could not be registered");
      }
      updateRow(row.id, {
        phase: "registered",
        documentId: document.id,
        registeredAt: now(),
      });
      options.onDocumentImported(document.id, key);
    } catch (error) {
      updateRow(row.id, {
        phase: "error",
        message: getErrorMessage(error, "Upload failed"),
      });
    }
  };

  const importGisFile = async ({ row, file }: QueuedDropItem<TFile>) => {
    updateRow(row.id, { phase: "uploading" });
    try {
      const stored = await withTimeout(
        options.uploadGisFile(file),
        timeouts.gisUpload,
        getUploadTimeoutMessage(timeouts.gisUpload),
      );
      updateRow(row.id, { phase: "processing" });
      const result = await withTimeout(
        options.saveGisLayers(file, stored.url),
        timeouts.gisProcessing,
        getGisProcessingTimeoutMessage(timeouts.gisProcessing),
      );
      updateRow(row.id, {
        phase: getGisResultPhase(result),
        message: getGisResultMessage(result),
      });
    } catch (error) {
      updateRow(row.id, {
        phase: "error",
        message: getErrorMessage(error, "Could not read GIS layers"),
      });
    }
  };

  const runs = items
    .filter((item) => item.phase === "queued")
    .map((item) => {
      const isGis = item.kind === "gis";
      const queue = isGis ? options.gisQueue : options.documentQueue;
      return queue
        .run(async () => {
          if (options.isRowRemoved(item.row.id)) {
            return;
          }
          await (isGis ? importGisFile(item) : importDocument(item));
        })
        .catch((error: unknown) => {
          // Outside the expected failures above: never leave a row spinning.
          options.failRow(
            item.row.id,
            getErrorMessage(error, "Something went wrong. Try again."),
          );
        });
    });

  await Promise.all(runs);
};

/** Marks the given rows failed, leaving any that already finished alone. */
export const failUnfinishedRows = (
  rows: DropRow[],
  ids: ReadonlySet<string>,
  message: string,
): DropRow[] => {
  return rows.map(
    (row): DropRow =>
      ids.has(row.id) && IN_PROGRESS_PHASES.has(row.phase)
        ? { ...row, phase: "error", message }
        : row,
  );
};

// ---------------------------------------------------------------------------
// Row status

/**
 * How long a registered row's document has waited for its text, or null when
 * it is not waiting (not registered, removed, or no longer pending).
 */
const getExtractionWaitMs = (
  row: DropRow,
  documents: DocumentExtraction[],
  now: number,
): number | null => {
  if (row.phase !== "registered") {
    return null;
  }
  const document = documents.find((doc) => doc.id === row.documentId);
  if (document?.extractionStatus !== "pending") {
    return null;
  }
  if (row.registeredAt !== undefined) {
    return Math.max(0, now - row.registeredAt);
  }
  // No client timestamp: fall back to the (clamped) server one. An
  // unparseable one counts as waited out.
  return (
    getExtractionAgeMs(document.createdAt, now) ?? Number.POSITIVE_INFINITY
  );
};

const finished = (
  status: Omit<DropRowStatus, "isFinished" | "isDismissable">,
): DropRowStatus => ({ ...status, isFinished: true, isDismissable: true });

const inProgress = (
  status: Omit<DropRowStatus, "isFinished" | "isDismissable">,
): DropRowStatus => ({ ...status, isFinished: false, isDismissable: false });

/** The status chip, and any extra detail line, for a dropzone row. */
export const getDropRowStatus = (
  row: DropRow,
  documents: DocumentExtraction[],
  now: number = Date.now(),
): DropRowStatus => {
  switch (row.phase) {
    case "queued":
      return {
        label: "Waiting",
        tone: "progress",
        isFinished: false,
        isDismissable: true,
      };
    case "uploading":
      return inProgress({ label: "Uploading", tone: "progress" });
    case "processing":
      return inProgress({ label: "Reading layers", tone: "progress" });
    case "error":
      return finished({ label: "Failed", tone: "error", detail: row.message });
    case "duplicate":
      return finished({
        label: "Already in project",
        tone: "neutral",
        detail: "Same name and size as an existing document",
      });
    case "done":
      return finished({ label: "Added", tone: "success", detail: row.message });
    case "registered": {
      const document = documents.find((doc) => doc.id === row.documentId);

      // The upload already put the new document in the cached list, so a
      // missing one was removed afterwards; stop waiting for its text.
      if (!document) {
        return finished({
          label: "Removed",
          tone: "warning",
          detail: "No longer in the project",
        });
      }
      // Pending for too long: the worker is not picking it up right now, so
      // stop the spinner instead of spinning on (polling goes on, slowly).
      const waitMs = getExtractionWaitMs(row, documents, now);
      if (waitMs !== null && waitMs >= EXTRACTION_STALE_AFTER_MS) {
        return finished({
          label: "Waiting for text extraction",
          tone: "neutral",
          detail:
            "Added. The assistant can read it once text extraction finishes.",
        });
      }
      if (document.extractionStatus === "pending") {
        return inProgress({
          label: "Extracting text",
          tone: "progress",
          detail: "Added to documents",
        });
      }
      if (document.extractionStatus === "failed") {
        return finished({
          label: "Text not extracted",
          tone: "warning",
          detail: document.extractionError ?? "Added, but no text was read",
        });
      }
      if (document.extractionStatus === "unsupported") {
        return finished({
          label: "No readable text",
          tone: "warning",
          detail: document.extractionError ?? "Added to documents",
        });
      }
      return finished({
        label: "Added",
        tone: "success",
        detail: "Text extracted",
      });
    }
  }
};

/**
 * Milliseconds until the next freshly pending row goes stale, or null when
 * none will; the dropzone re-renders then so the row stops spinning.
 */
export const getNextStaleDelay = (
  rows: DropRow[],
  documents: DocumentExtraction[],
  now: number = Date.now(),
): number | null => {
  let nextDelay: number | null = null;
  for (const row of rows) {
    const waitMs = getExtractionWaitMs(row, documents, now);
    if (waitMs === null) {
      continue;
    }
    const delay = EXTRACTION_STALE_AFTER_MS - waitMs;
    if (delay > 0) {
      nextDelay = nextDelay === null ? delay : Math.min(nextDelay, delay);
    }
  }
  return nextDelay;
};
