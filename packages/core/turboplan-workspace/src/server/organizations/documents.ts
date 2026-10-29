import type { OrganizationDocument } from "@wildfires-org/turboplan-db";
import { deleteOrganizationDocument } from "@wildfires-org/turboplan-db/queries";
import { deleteOwnedStorageFile } from "@wildfires-org/turboplan-upload/server";

import { isDocumentUrlReferenced } from "../documents/references";

/**
 * Delete an organization document row, then its stored object when that is
 * safe: the object must live under the uploader's own prefix, and no other
 * organization or project document may still reference it (the same upload
 * can be registered in both). A row whose uploader was deleted keeps its
 * object — an orphan is preferable to deleting a blob we cannot attribute.
 * Callers do authorization; the blob delete is best-effort and never throws.
 */
export const removeOrganizationDocument = async (
  document: Pick<OrganizationDocument, "id" | "uploadedBy" | "url">,
): Promise<void> => {
  await deleteOrganizationDocument(document.id);

  await deleteOwnedStorageFile(
    document.url,
    { userId: document.uploadedBy },
    () => isDocumentUrlReferenced(document.url),
  );
};
