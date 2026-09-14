import type { ApiClient } from "@wildfires-org/turboplan-api-client";

interface RegisterProjectDocumentParams {
  projectId: string;
  file: File;
  // Public URL of the already-uploaded blob in storage.
  url: string;
  // Storage pathname returned by the upload; its last segment becomes the
  // stored filename. Falls back to the original file name when absent.
  pathname?: string;
}

/**
 * Register an already-uploaded blob as a project document by POSTing its
 * metadata to `/api/project-documents`. The blob must already live in storage —
 * this only records it against the project's document library.
 *
 * Returns `true` on success and `false` on any failure (permission or
 * otherwise) so callers can decide how to surface the result. Best-effort by
 * design: it never throws.
 */
export const registerProjectDocument = async (
  apiClient: ApiClient,
  { projectId, file, url, pathname }: RegisterProjectDocumentParams,
): Promise<boolean> => {
  const { error } = await apiClient.post("/api/project-documents", {
    projectId,
    filename: pathname?.split("/").pop() ?? file.name,
    originalFilename: file.name,
    mimeType: file.type,
    size: file.size,
    url,
  });

  return !error;
};
