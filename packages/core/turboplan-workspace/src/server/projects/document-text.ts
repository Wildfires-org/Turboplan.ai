import type {
  ProjectDocument,
  ProjectDocumentExtractionStatus,
} from "@wildfires-org/turboplan-db";

/** Body of `GET /api/project-documents/:id/text`. */
export type ProjectDocumentTextResponse = {
  status: ProjectDocumentExtractionStatus;
  /** Stored extracted text (already capped at extraction time); null unless done */
  text: string | null;
  /** Why extraction failed or the type is unsupported; null otherwise */
  error: string | null;
};

/**
 * Shape a document's extraction state for the preview. Text is only returned
 * for a finished extraction and the error only for a failed/unsupported one,
 * so a stale value left on the row by an earlier run never leaks through.
 */
export const toDocumentTextResponse = (
  document: Pick<
    ProjectDocument,
    "extractionStatus" | "extractedText" | "extractionError"
  >,
): ProjectDocumentTextResponse => {
  const status = document.extractionStatus;
  const hasError = status === "failed" || status === "unsupported";

  return {
    status,
    text: status === "done" ? (document.extractedText ?? "") : null,
    error: hasError ? (document.extractionError ?? null) : null,
  };
};
