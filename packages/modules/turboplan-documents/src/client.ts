"use client";

// Components
export {
  DocumentCardEditable,
  type EditableDocumentCardData,
} from "./components/document-card";
export {
  DocumentsReadOnlyList,
  type DocumentsReadOnlyListProps,
  type ReadOnlyDocument,
} from "./components/documents-read-only-list";
export {
  DocumentsSectionUI,
  type DocumentsSectionUIProps,
} from "./components/documents-section";
export {
  DocumentPreviewDialog,
  type DocumentPreviewDialogProps,
} from "./components/preview/document-preview-dialog";
export {
  ProjectDocumentsSection,
  type ProjectDocumentsSectionProps,
} from "./components/project-documents-section";
// Constants
export {
  ACCEPT_STRING,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from "./components/utils";
export { getPreviewDocumentMimeType } from "./document-mime";
// Hooks
export { useProjectDocuments } from "./hooks/use-project-documents";
// Types
export type {
  ProjectDocument,
  ProjectDocumentExtractionStatus,
  ProjectDocumentSource,
  ProjectDocumentUploader,
  UseProjectDocumentsOptions,
  UseProjectDocumentsReturn,
} from "./types";
// Non-hook helpers
export {
  EXTRACTION_STALE_AFTER_MS,
  getMsUntilExtractionStale,
  isExtractionStale,
} from "./types";
export { uploadBlobToProject } from "./upload-blob-to-project";
