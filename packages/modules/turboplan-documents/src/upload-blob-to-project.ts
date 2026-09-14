import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { UploadClient } from "@wildfires-org/turboplan-upload/client";

import type { ProjectDocument } from "./types";

/**
 * Upload an in-memory blob (wrapped as a File) to a project's documents
 * without relying on React hooks. Mirrors the body of
 * `useProjectDocuments().uploadDocument`, but is safe to call from
 * event handlers and other non-component contexts.
 */
export const uploadBlobToProject = async (
  projectId: string,
  file: File,
): Promise<ProjectDocument> => {
  const uploadResult = await new UploadClient().upload(file);

  const { data, error } = await new ApiClient().post<ProjectDocument>(
    "/api/project-documents",
    {
      projectId,
      filename: uploadResult.pathname.split("/").pop() ?? file.name,
      originalFilename: file.name,
      mimeType: file.type,
      size: file.size,
      url: uploadResult.url,
    },
  );

  if (error || !data) {
    throw new Error(error ?? "Failed to save document to project");
  }

  return data;
};
