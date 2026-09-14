import { getUserByEmail } from "@wildfires-org/turboplan-db/queries";

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
