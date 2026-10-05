import {
  getOrganizationContextSources,
  getOrganizationIdForProject,
} from "@wildfires-org/turboplan-db/queries";

import {
  buildOrganizationContextBlock,
  getReadableOrganizationDocumentIds,
  type OrganizationContextBlockOptions,
} from "./context-builder";

export type OrganizationContextForProject = {
  organizationId: string;
  block: string;
  /** Documents whose full text a reader tool can return (extraction done) */
  readableDocumentIds: string[];
};

/**
 * The budgeted context block of the organization that owns the project, or
 * null when the project is missing or its organization has nothing to share.
 * Callers must check the user may READ `organizationId` before using it.
 */
export const getOrganizationContextForProject = async (
  projectId: string,
  options: OrganizationContextBlockOptions,
): Promise<OrganizationContextForProject | null> => {
  const organizationId = await getOrganizationIdForProject(projectId);
  if (!organizationId) {
    return null;
  }

  const sources = await getOrganizationContextSources(organizationId);
  if (!sources) {
    return null;
  }

  const block = buildOrganizationContextBlock(sources, options);
  if (!block) {
    return null;
  }

  return {
    organizationId,
    block,
    readableDocumentIds: getReadableOrganizationDocumentIds(sources),
  };
};
