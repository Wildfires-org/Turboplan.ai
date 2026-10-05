import type { ProjectDocument } from "@wildfires-org/turboplan-db";
import { deleteProjectDocument } from "@wildfires-org/turboplan-db/queries";
import { deleteOwnedStorageFile } from "@wildfires-org/turboplan-upload/server";

import { isDocumentUrlReferenced } from "../documents/references";

/**
 * Delete a project document row, then its stored object when that is safe:
 * the object must live under the row's own uploader or project prefix, and no
 * other project or organization document may still reference it (copied
 * projects share objects, and one upload can be registered as both kinds).
 * Callers do authorization; the blob delete is best-effort and never throws.
 */
export const removeProjectDocument = async (
  document: Pick<ProjectDocument, "id" | "projectId" | "userId" | "url">,
): Promise<void> => {
  await deleteProjectDocument(document.id);

  await deleteOwnedStorageFile(
    document.url,
    { userId: document.userId, projectId: document.projectId },
    () => isDocumentUrlReferenced(document.url),
  );
};
