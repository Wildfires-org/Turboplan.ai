import { eq } from "drizzle-orm";

import {
  isOwnershipStatusPubliclyVisible,
  office,
  organization,
  project,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  OrganizationType,
  type ProjectModule,
  PUBLICLY_LISTED_ORG_TYPES,
} from "@wildfires-org/turboplan-db/types";

export interface PublicGovReadAccessOptions {
  /**
   * When provided, the fallback additionally requires the named module to
   * NOT be in the project's hiddenModules or privateModules arrays. Typed
   * against the canonical list so typos fail at compile time.
   */
  moduleName?: ProjectModule;
}

export const isPublicGovProjectReadAllowed = async (
  projectId: string,
  options: PublicGovReadAccessOptions = {},
): Promise<boolean> => {
  const [result] = await db
    .select({
      isPublic: project.isPublic,
      status: project.status,
      isTemplate: project.isTemplate,
      ownershipStatus: project.ownershipStatus,
      hiddenModules: project.hiddenModules,
      privateModules: project.privateModules,
      orgType: organization.type,
    })
    .from(project)
    .innerJoin(office, eq(project.officeId, office.id))
    .innerJoin(organization, eq(office.organizationId, organization.id))
    .where(eq(project.id, projectId))
    .limit(1);

  if (!result) {
    return false;
  }

  if (!result.isPublic || result.status === "archived" || result.isTemplate) {
    return false;
  }

  // An application under review is never public, even with isPublic set.
  if (!isOwnershipStatusPubliclyVisible(result.ownershipStatus)) {
    return false;
  }

  // Publicly-listed org types (government + environmental planning) allow the
  // public-read fallback; all other org types do not.
  if (!PUBLICLY_LISTED_ORG_TYPES.includes(result.orgType as OrganizationType)) {
    return false;
  }

  if (options.moduleName) {
    const hidden = (result.hiddenModules as string[] | null) ?? [];
    const priv = (result.privateModules as string[] | null) ?? [];
    if (
      hidden.includes(options.moduleName) ||
      priv.includes(options.moduleName)
    ) {
      return false;
    }
  }

  return true;
};
