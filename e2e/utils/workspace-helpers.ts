import { getUserByEmail } from "@wildfires-org/turboplan-db/queries";
import {
  assignOrganizationOwner,
  createOffice,
  createOfficeUser,
  createOrganization,
  OrganizationType,
} from "@wildfires-org/turboplan-workspace/server";

import {
  getCitizenCredentials,
  getGovCredentials,
} from "../config/test-credentials";
import {
  getTestGovernmentOrganization,
  getTestOffice,
  getTestUserOrganization,
} from "./test-invitations";

export type WorkspaceInfo = {
  orgSlug: string;
  officeSlug: string;
  officeId: string;
  userId: string;
};

/**
 * Resolve the gov user's GOVERNMENT-type workspace from the database.
 * Replaces the duplicated 6-line lookup pattern in beforeAll blocks.
 */
export const getGovWorkspace = async (): Promise<WorkspaceInfo> => {
  const govCreds = getGovCredentials();
  if (!govCreds) {
    throw new Error(
      "Gov credentials not found. Make sure auth-gov.setup.ts ran successfully.",
    );
  }

  const govUser = await getUserByEmail(govCreds.email);
  if (!govUser) {
    throw new Error("Gov user not found in database");
  }

  const govOrg = await getTestGovernmentOrganization(govUser.id);
  if (!govOrg) {
    throw new Error("Gov GOVERNMENT organization not found");
  }

  const govOffice = await getTestOffice(govOrg.id);
  if (!govOffice) {
    throw new Error("Gov office not found");
  }

  return {
    orgSlug: govOrg.slug,
    officeSlug: govOffice.slug,
    officeId: govOffice.id,
    userId: govUser.id,
  };
};

/**
 * Resolve the citizen user's personal workspace from the database.
 * Replaces the duplicated lookup pattern in beforeAll blocks.
 */
export const getCitizenWorkspace = async (): Promise<WorkspaceInfo> => {
  const citizenCreds = getCitizenCredentials();
  if (!citizenCreds) {
    throw new Error(
      "Citizen credentials not found. Make sure auth-citizen.setup.ts ran successfully.",
    );
  }

  const citizenUser = await getUserByEmail(citizenCreds.email);
  if (!citizenUser) {
    throw new Error("Citizen user not found in database");
  }

  const citizenOrg = await getTestUserOrganization(citizenUser.id);
  if (!citizenOrg) {
    throw new Error("Citizen organization not found");
  }

  const citizenOffice = await getTestOffice(citizenOrg.id);
  if (!citizenOffice) {
    throw new Error("Citizen office not found");
  }

  return {
    orgSlug: citizenOrg.slug,
    officeSlug: citizenOffice.slug,
    officeId: citizenOffice.id,
    userId: citizenUser.id,
  };
};

export type TestOrganization = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Create a fresh BUSINESS organization owned by `ownerId`, so a spec can change
 * its members without leaking into the shared citizen/gov workspaces.
 */
export const createTestOrganization = async (params: {
  ownerId: string;
  name: string;
}): Promise<TestOrganization> => {
  const org = await createOrganization({
    name: params.name,
    description: "Organization for E2E testing",
    type: OrganizationType.BUSINESS,
    createdBy: params.ownerId,
  });

  await assignOrganizationOwner(params.ownerId, org.id);

  return { id: org.id, slug: org.slug, name: org.name };
};

/**
 * Put `userId` in an organization's tree WITHOUT making them an organization
 * member: a viewer of a new office there (created by `ownerId`). Such a user is
 * reachable by the organization's fuzzy user search but is not in its member
 * list.
 */
export const addOrganizationOfficeViewer = async (params: {
  organizationId: string;
  ownerId: string;
  userId: string;
}): Promise<void> => {
  const office = await createOffice({
    name: `E2E Office ${Date.now()}`,
    organizationId: params.organizationId,
    createdBy: params.ownerId,
  });

  await createOfficeUser({
    officeId: office.id,
    userId: params.userId,
    role: "viewer",
  });
};
