import {
  getMsUntilExtractionStale,
  isExtractionStale,
  type ProjectDocumentExtractionStatus,
} from "@wildfires-org/turboplan-documents/types";
import type { GisZipSaveResult } from "@wildfires-org/turboplan-map/client";
import {
  isLegacyWordDocument,
  type ProjectFileKind,
} from "@wildfires-org/turboplan-upload/types";

// Pure status logic for the Project Context dropzone rows, kept apart from the
// component so it can be unit tested.

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
  /** Set once a document row is registered with the project */
  documentId?: string;
  /** Content type the file was uploaded with */
  contentType?: string;
};

/** Why a legacy .doc upload finishes as a warning. */
export const LEGACY_WORD_MESSAGE =
  "Added — the assistant can't read .doc files. Save as .docx and upload again so it can.";

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
};

type DocumentExtraction = {
  id: string;
  extractionStatus?: ProjectDocumentExtractionStatus;
  extractionError?: string | null;
  createdAt: string;
};

// Poll the documents list while a dropped document waits for its text; the
// extraction worker picks new documents up within a few seconds.
export const EXTRACTION_POLL_INTERVAL_MS = 4000;

const MB = 1024 * 1024;

/** Duplicate key for a document: file name + size, as the chat input uses. */
export const getDocumentDedupeKey = (name: string, size: number) =>
  `${name}:${size}`;

export const formatMegabytes = (bytes: number) => `${Math.round(bytes / MB)}MB`;

/** Short type label shown under the file name. */
export const getDropRowTypeLabel = (row: Pick<DropRow, "name" | "kind">) => {
  if (row.kind === "gis") {
    const dotIndex = row.name.lastIndexOf(".");
    return dotIndex > 0
      ? `GIS layers (${row.name.slice(dotIndex).toLowerCase()})`
      : "GIS layers";
  }
  if (row.kind === "unsupported") {
    return "Unsupported file";
  }
  return row.name.toLowerCase().endsWith(".pdf") ? "PDF" : "Word document";
};

/** One-line summary of a saved GIS archive, e.g. "3 layers added". */
export const formatGisResult = (result: GisZipSaveResult): string => {
  const parts: string[] = [];

  if (result.added > 0) {
    parts.push(
      `${result.added} layer${result.added === 1 ? "" : "s"} added to the map`,
    );
  }
  if (result.skipped > 0) {
    parts.push(`${result.skipped} already in the project`);
  }
  if (result.failed > 0) {
    parts.push(`${result.failed} could not be saved`);
  }

  return parts.length > 0 ? parts.join(", ") : "No layers added";
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

/** The status chip, and any extra detail line, for a dropzone row. */
export const getDropRowStatus = (
  row: DropRow,
  documents: DocumentExtraction[],
  now: number = Date.now(),
): DropRowStatus => {
  switch (row.phase) {
    case "queued":
      return { label: "Waiting", tone: "progress", isFinished: false };
    case "uploading":
      return { label: "Uploading", tone: "progress", isFinished: false };
    case "processing":
      return {
        label: "Reading layers",
        tone: "progress",
        isFinished: false,
      };
    case "error":
      return {
        label: "Failed",
        tone: "error",
        detail: row.message,
        isFinished: true,
      };
    case "duplicate":
      return {
        label: "Already in project",
        tone: "neutral",
        detail: "Same name and size as an existing document",
        isFinished: true,
      };
    case "done":
      return {
        label: "Added",
        tone: "success",
        detail: row.message,
        isFinished: true,
      };
    case "registered": {
      // Stored, but the text extractor cannot read the old binary format.
      if (
        isLegacyWordDocument({ name: row.name, type: row.contentType ?? "" })
      ) {
        return {
          label: "Added",
          tone: "warning",
          detail: LEGACY_WORD_MESSAGE,
          isFinished: true,
        };
      }

      const document = documents.find((doc) => doc.id === row.documentId);

      // The upload already put the new document in the cached list, so a
      // missing one was removed afterwards; stop waiting for its text.
      if (!document) {
        return {
          label: "Removed",
          tone: "warning",
          detail: "No longer in the project",
          isFinished: true,
        };
      }
      // Pending for too long: the worker is not picking it up right now, so
      // stop the spinner (and the polling) instead of waiting forever.
      if (isExtractionStale(document, now)) {
        return {
          label: "Waiting for text extraction",
          tone: "neutral",
          detail:
            "Added. The assistant can read it once text extraction finishes.",
          isFinished: true,
        };
      }
      if (document.extractionStatus === "pending") {
        return {
          label: "Extracting text",
          tone: "progress",
          detail: "Added to documents",
          isFinished: false,
        };
      }
      if (document.extractionStatus === "failed") {
        return {
          label: "Text not extracted",
          tone: "warning",
          detail: document.extractionError ?? "Added, but no text was read",
          isFinished: true,
        };
      }
      if (document.extractionStatus === "unsupported") {
        return {
          label: "No readable text",
          tone: "warning",
          detail: document.extractionError ?? "Added to documents",
          isFinished: true,
        };
      }
      return {
        label: "Added",
        tone: "success",
        detail: "Text extracted",
        isFinished: true,
      };
    }
  }
};

/** True while any registered document row still waits for its text. */
export const hasPendingExtraction = (
  rows: DropRow[],
  documents: DocumentExtraction[],
  now: number = Date.now(),
) => {
  return rows.some(
    (row) =>
      row.phase === "registered" &&
      !getDropRowStatus(row, documents, now).isFinished,
  );
};

/**
 * SWR poll interval for the documents list: poll while a dropped document is
 * freshly pending, stop (0) once none is or every pending one has gone stale.
 */
export const getExtractionPollInterval = (
  rows: DropRow[],
  documents: DocumentExtraction[],
  now: number = Date.now(),
) => {
  return hasPendingExtraction(rows, documents, now)
    ? EXTRACTION_POLL_INTERVAL_MS
    : 0;
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
    if (row.phase !== "registered") {
      continue;
    }
    const document = documents.find((doc) => doc.id === row.documentId);
    if (document?.extractionStatus !== "pending") {
      continue;
    }
    const delay = getMsUntilExtractionStale(document.createdAt, now);
    if (delay > 0 && Number.isFinite(delay)) {
      nextDelay = nextDelay === null ? delay : Math.min(nextDelay, delay);
    }
  }
  return nextDelay;
};
