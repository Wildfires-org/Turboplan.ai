// Logic for the Organization Context page, kept free of React so it can be
// unit tested: the prompt schema, planning a document drop, the status of each
// upload row and of each listed document, and the list order.

import { z } from "zod";

import {
  classifyProjectFile,
  isProjectDocumentMimeType,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
  PROJECT_DOCUMENT_MIME_TYPES,
} from "@wildfires-org/turboplan-upload/types";
import {
  ORGANIZATION_DOCUMENTS_MAX,
  ORGANIZATION_PROMPT_MAX_CHARS,
} from "@wildfires-org/turboplan-workspace/types";

import type { OrganizationDocument } from "../types/organization-context";
import { formatMegabytes, getDocumentDedupeKey } from "./document-upload-queue";

export type OrganizationDropRowPhase =
  | "queued"
  | "uploading"
  | "added"
  | "duplicate"
  | "error";

export type OrganizationDropRow = {
  id: string;
  name: string;
  phase: OrganizationDropRowPhase;
  /** Upload progress (0-100) while "uploading" */
  progress?: number;
  /** Rejection or error text of an "error" row */
  message?: string;
};

export type OrganizationDropRowTone =
  | "progress"
  | "success"
  | "neutral"
  | "error";

export type OrganizationDropRowStatus = {
  label: string;
  tone: OrganizationDropRowTone;
  detail?: string;
  isFinished: boolean;
  /** Finished, or still waiting its turn (dismissing takes it off the queue) */
  isDismissable: boolean;
};

type DropFile = {
  name: string;
  size: number;
  type: string;
};

export type OrganizationDropPlanItem<TFile extends DropFile> = {
  file: TFile;
  phase: Extract<OrganizationDropRowPhase, "queued" | "duplicate" | "error">;
  /** Rejection reason of an "error" item */
  message?: string;
  /** Name + size key, re-checked right before the file uploads */
  dedupeKey: string;
};

export type OrganizationDocumentStatusTone =
  | "progress"
  | "success"
  | "neutral"
  | "error";

export type OrganizationDocumentStatus = {
  label: string;
  tone: OrganizationDocumentStatusTone;
  /** Extra line under the file name, if any */
  detail?: string;
};

/** Machine-readable code of the 409 the API answers past the document limit. */
export const ORGANIZATION_DOCUMENTS_LIMIT_CODE =
  "ORGANIZATION_DOCUMENTS_LIMIT_REACHED";

/**
 * How much of the prompt reaches the research agent. Mirrors
 * `ORG_CONTEXT_RESEARCH_PROMPT_MAX_CHARS` in `turboplan-workspace/server`
 * (a server-only export).
 */
export const RESEARCH_AGENT_PROMPT_CHARS = 1_500;

/**
 * Characters of extracted text the AI gets for a document without a summary.
 * Mirrors `ORGANIZATION_DOCUMENT_EXCERPT_CHARS` in `turboplan-db/queries`.
 */
export const DOCUMENT_EXCERPT_CHARS = 400;

export const ORGANIZATION_DOCUMENTS_LIMIT_MESSAGE = `This organization already has ${ORGANIZATION_DOCUMENTS_MAX} documents, the most it can hold. Delete one to add another.`;

const KB = 1024;
const MB = 1024 * 1024;

export const formatCount = (value: number) => value.toLocaleString("en-US");

/** Same rule as the API: trimmed, at most ORGANIZATION_PROMPT_MAX_CHARS. */
export const organizationPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .max(
      ORGANIZATION_PROMPT_MAX_CHARS,
      `Keep the prompt to ${formatCount(ORGANIZATION_PROMPT_MAX_CHARS)} characters or fewer`,
    ),
});

export type OrganizationPromptFormValues = z.infer<
  typeof organizationPromptSchema
>;

// ---------------------------------------------------------------------------
// Formatting

export const formatFileSize = (bytes: number) => {
  if (bytes < KB) {
    return `${bytes} B`;
  }
  if (bytes < MB) {
    return `${Math.round(bytes / KB)} KB`;
  }
  return `${(bytes / MB).toFixed(1)} MB`;
};

/** "PDF", "DOC" or "DOCX" from a document's MIME type. */
export const getDocumentTypeLabel = (mimeType: string) => {
  if (!isProjectDocumentMimeType(mimeType)) {
    return "File";
  }
  return PROJECT_DOCUMENT_MIME_TYPES[mimeType][0].slice(1).toUpperCase();
};

/** "Oct 5, 2026", or null when the date does not parse. */
export const formatShortDate = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/** Length the API validates: the prompt after trimming. */
export const getPromptLength = (prompt: string) => prompt.trim().length;

// ---------------------------------------------------------------------------
// Planning a drop

/** Why a dropped file is not added, or null when it can be. */
const getDropRejection = (file: DropFile): string | null => {
  if (classifyProjectFile(file) !== "document") {
    return "Only PDF and Word documents (.pdf, .doc, .docx) can be added";
  }
  if (file.size === 0) {
    return "The file is empty (0 bytes)";
  }
  if (file.size > PROJECT_DOCUMENT_MAX_FILE_SIZE) {
    return `File too large, max ${formatMegabytes(PROJECT_DOCUMENT_MAX_FILE_SIZE)}`;
  }
  return null;
};

/**
 * What happens to each dropped file, in drop order: rejected, skipped as a
 * duplicate (same name + size as one of `blockedKeys` — documents already
 * listed or still in the upload queue — or as an earlier file of this drop),
 * or queued for upload.
 */
export const planOrganizationDrop = <TFile extends DropFile>(
  files: TFile[],
  blockedKeys: ReadonlySet<string>,
): OrganizationDropPlanItem<TFile>[] => {
  const seenKeys = new Set(blockedKeys);

  return files.map((file) => {
    const dedupeKey = getDocumentDedupeKey(file.name, file.size);
    const rejection = getDropRejection(file);
    if (rejection) {
      return { file, dedupeKey, phase: "error", message: rejection };
    }
    if (seenKeys.has(dedupeKey)) {
      return { file, dedupeKey, phase: "duplicate" };
    }
    seenKeys.add(dedupeKey);
    return { file, dedupeKey, phase: "queued" };
  });
};

/**
 * Whether one more document would go past the limit: the listed documents
 * plus those added this session that the list does not show yet.
 */
export const isAtDocumentLimit = (
  documents: Pick<OrganizationDocument, "id">[],
  imported: ReadonlyMap<string, string>,
) => {
  const listedIds = new Set(documents.map((document) => document.id));
  const unlisted = Array.from(imported.keys()).filter(
    (documentId) => !listedIds.has(documentId),
  ).length;
  return documents.length + unlisted >= ORGANIZATION_DOCUMENTS_MAX;
};

// ---------------------------------------------------------------------------
// Statuses

/** The status chip, and any extra detail line, for an upload row. */
export const getOrganizationDropRowStatus = (
  row: OrganizationDropRow,
): OrganizationDropRowStatus => {
  switch (row.phase) {
    case "queued":
      return {
        label: "Waiting",
        tone: "progress",
        isFinished: false,
        isDismissable: true,
      };
    case "uploading":
      return {
        label: "Uploading",
        tone: "progress",
        isFinished: false,
        isDismissable: false,
      };
    case "added":
      return {
        label: "Added",
        tone: "success",
        detail: "Processing starts in a few seconds",
        isFinished: true,
        isDismissable: true,
      };
    case "duplicate":
      return {
        label: "Already added",
        tone: "neutral",
        detail: "Same name and size as a document already here",
        isFinished: true,
        isDismissable: true,
      };
    case "error":
      return {
        label: "Failed",
        tone: "error",
        detail: row.message,
        isFinished: true,
        isDismissable: true,
      };
  }
};

/**
 * Status badge of a listed document. `isStale`: pending past the point where
 * the extraction worker should have picked it up (see `useIsExtractionStale`).
 */
export const getOrganizationDocumentStatus = (
  document: Pick<
    OrganizationDocument,
    "extractionStatus" | "extractionError" | "summary"
  >,
  isStale: boolean,
): OrganizationDocumentStatus => {
  switch (document.extractionStatus) {
    case "pending":
      return isStale
        ? {
            label: "Waiting to process",
            tone: "neutral",
            detail:
              "Processing has not started yet. The AI can use this document once it finishes.",
          }
        : { label: "Processing", tone: "progress" };
    case "done":
      return document.summary
        ? { label: "Ready", tone: "success" }
        : {
            label: "Summary unavailable",
            tone: "neutral",
            detail: `The AI sees the first ${formatCount(DOCUMENT_EXCERPT_CHARS)} characters instead.`,
          };
    case "failed":
      return {
        label: "Failed",
        tone: "error",
        detail:
          document.extractionError ??
          "No text could be read, so the AI cannot use this document.",
      };
    case "unsupported":
      return {
        label: "Unsupported",
        tone: "neutral",
        detail:
          document.extractionError ??
          "This file has no readable text, so the AI cannot use it.",
      };
  }
};

// ---------------------------------------------------------------------------
// Order

/** Key documents first, then newest first: the order the AI reads them in. */
export const sortOrganizationDocuments = (
  documents: OrganizationDocument[],
): OrganizationDocument[] => {
  return [...documents].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
};

// ---------------------------------------------------------------------------
// Announcements

/**
 * Screen reader text for documents that finished processing since the
 * previous list (`previous`: status by document id, null on first load), or
 * null when none did.
 */
export const getProcessingAnnouncement = (
  previous: ReadonlyMap<
    string,
    OrganizationDocument["extractionStatus"]
  > | null,
  documents: Pick<
    OrganizationDocument,
    | "id"
    | "originalFilename"
    | "extractionStatus"
    | "extractionError"
    | "summary"
  >[],
): string | null => {
  if (!previous) {
    return null;
  }
  const messages = documents
    .filter(
      (document) =>
        previous.get(document.id) === "pending" &&
        document.extractionStatus !== "pending",
    )
    .map(
      (document) =>
        `${document.originalFilename}: ${getOrganizationDocumentStatus(document, false).label}`,
    );
  return messages.length > 0 ? messages.join(". ") : null;
};
