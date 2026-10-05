import type { OrganizationDocumentExtractionStatus } from "@wildfires-org/turboplan-db/types";

/** `GET` / `PUT /api/organizations/:id/context` */
export type OrganizationContextPrompt = {
  prompt: string;
  /** Null until the prompt is first saved */
  updatedAt: string | null;
};

/** One document of `GET /api/organization-documents` (dates as ISO strings). */
export type OrganizationDocument = {
  id: string;
  organizationId: string;
  filename: string;
  /** Display name */
  originalFilename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string | null;
  /** Key document: summarized into the AI context before the rest */
  isPinned: boolean;
  extractionStatus: OrganizationDocumentExtractionStatus;
  extractionError: string | null;
  extractedAt: string | null;
  /** Short AI "key facts" summary; null until produced (or when it failed) */
  summary: string | null;
  summarizedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationDocumentsResponse = {
  documents: OrganizationDocument[];
};
