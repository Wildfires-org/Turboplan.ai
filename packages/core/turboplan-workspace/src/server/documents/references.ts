import {
  hasOrganizationDocumentWithUrl,
  hasProjectDocumentWithUrl,
} from "@wildfires-org/turboplan-db/queries";

/**
 * Whether any organization or project document row still references the
 * stored object at `url`. One upload can be registered as both kinds (and
 * copied projects share objects), so deleting either kind of document must
 * check both tables before removing the blob.
 */
export const isDocumentUrlReferenced = async (
  url: string,
): Promise<boolean> => {
  const [isOrganizationReferenced, isProjectReferenced] = await Promise.all([
    hasOrganizationDocumentWithUrl(url),
    hasProjectDocumentWithUrl(url),
  ]);

  return isOrganizationReferenced || isProjectReferenced;
};
