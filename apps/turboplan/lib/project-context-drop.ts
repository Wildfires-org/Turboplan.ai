import type { ProjectDocumentExtractionStatus } from "@wildfires-org/turboplan-documents/client";
import type { GisZipSaveResult } from "@wildfires-org/turboplan-map/client";
import type { ProjectFileKind } from "@wildfires-org/turboplan-upload/types";

// Pure status logic for the Project Context dropzone rows, kept apart from the
// component so it can be unit tested.

export type DropRowPhase =
  | "queued"
  | "uploading"
  | "processing"
  | "registered"
  | "done"
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
};

export type DropRowTone = "progress" | "success" | "warning" | "error";

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
};

const MB = 1024 * 1024;

export const formatMegabytes = (bytes: number) => `${Math.round(bytes / MB)}MB`;

/** Short type label shown under the file name. */
export const getDropRowTypeLabel = (row: Pick<DropRow, "name" | "kind">) => {
  if (row.kind === "gis-zip") {
    return "GIS layers (ZIP)";
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
    case "done":
      return {
        label: "Added",
        tone: "success",
        detail: row.message,
        isFinished: true,
      };
    case "registered": {
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
) => {
  return rows.some(
    (row) =>
      row.phase === "registered" &&
      !getDropRowStatus(row, documents).isFinished,
  );
};
