/**
 * Test utilities for invitation flow E2E tests.
 *
 * Uses workspace service-layer functions instead of raw Drizzle queries,
 * so these utilities stay in sync when DB schemas change.
 */

import {
  assignOrganizationOwner,
  createOffice,
  createOrganization,
  createProject,
  getInvitationById,
  getInvitationByToken,
  getInvitationService,
  getOfficesByOrganization,
  getUserAccessibleOrganizations,
  OrganizationType,
} from "@wildfires-org/turboplan-workspace/server";

export interface TestInvitation {
  id: string;
  token: string;
  email: string;
  role: string;
  entityType: "organization" | "office" | "project";
  entityId: string;
  entityName: string;
  inviteUrl: string;
}

/**
 * Get the citizen's personal (non-government) organization.
 * Filters out government orgs so that citizen tests don't accidentally
 * navigate to a gov org where the citizen has limited permissions.
 */
export const getTestUserOrganization = async (
  userId: string,
): Promise<{ id: string; name: string; slug: string } | null> => {
  const orgs = await getUserAccessibleOrganizations(userId);
  const personalOrg = orgs.find((o) => o.type !== "government");
  return personalOrg || orgs[0] || null;
};

/**
 * Get the GOVERNMENT-type organization for a user.
 * Returns the first government org created by the user.
 */
export const getTestGovernmentOrganization = async (
  userId: string,
): Promise<{ id: string; name: string; slug: string } | null> => {
  const orgs = await getUserAccessibleOrganizations(userId);
  const govOrg = orgs.find((o) => o.type === "government");
  return govOrg || null;
};

/**
 * Create a GOVERNMENT-type organization with an office, and assign a user as owner.
 * Used in E2E setup so citizens can discover the gov org in the office selector.
 */
export const createGovernmentOrganization = async (params: {
  name: string;
  officeName: string;
  officeDescription?: string;
  ownerId: string;
  /**
   * Email domains registered on the org so email-domain affiliation detection
   * resolves matching users to the government_agency role (role selection was
   * removed from setup — affiliation is the only way a test user gets it).
   */
  emailDomains?: string[];
}): Promise<{
  orgId: string;
  orgSlug: string;
  officeId: string;
  officeSlug: string;
}> => {
  const { name, officeName, officeDescription, ownerId, emailDomains } = params;

  const newOrg = await createOrganization({
    name,
    description: "Government organization for E2E testing",
    type: OrganizationType.GOVERNMENT,
    emailDomains,
    createdBy: ownerId,
  });

  await assignOrganizationOwner(ownerId, newOrg.id);

  const newOffice = await createOffice({
    name: officeName,
    description: officeDescription,
    organizationId: newOrg.id,
    createdBy: ownerId,
  });

  return {
    orgId: newOrg.id,
    orgSlug: newOrg.slug,
    officeId: newOffice.id,
    officeSlug: newOffice.slug,
  };
};

/**
 * Get the first office for an organization
 */
export const getTestOffice = async (
  organizationId: string,
): Promise<{ id: string; name: string; slug: string } | null> => {
  const offices = await getOfficesByOrganization(organizationId, { limit: 1 });
  return offices[0] || null;
};

/**
 * Get the first project for an office
 *
 * Note: There is no workspace query to list projects by officeId without
 * slug-based lookup, so we keep a minimal Drizzle query here.
 */
export const getTestProject = async (
  officeId: string,
): Promise<{ id: string; name: string; slug: string } | null> => {
  const { eq } = await import("drizzle-orm");
  const { project } = await import("@wildfires-org/turboplan-db");
  const { db } = await import("@wildfires-org/turboplan-db/db-client");

  const result = await db
    .select({
      id: project.id,
      name: project.name,
      slug: project.slug,
    })
    .from(project)
    .where(eq(project.officeId, officeId))
    .limit(1);

  return result[0] || null;
};

/**
 * Create a test invitation via the invitation service.
 * Returns the invitation details including the invite URL.
 */
export const createTestInvitation = async (params: {
  email: string;
  entityType: "organization" | "office" | "project";
  entityId: string;
  entityName: string;
  role: "owner" | "editor" | "viewer";
  invitedBy: string;
  baseUrl?: string;
}): Promise<TestInvitation | null> => {
  const {
    email,
    entityType,
    entityId,
    entityName,
    role,
    invitedBy,
    baseUrl = process.env.TURBOPLAN_URL || "http://localhost:3000",
  } = params;

  const invitationService = getInvitationService();

  const result = await invitationService.createInvitation({
    email,
    entityType,
    entityId,
    role,
    invitedBy,
  });

  if (!result) {
    return null;
  }

  // The DB stores only the SHA-256 hash of the token, so it cannot be read back
  // from the invitation row. The raw token returned by createInvitation is the
  // only copy — it is what goes in the emailed link and what /invite/[token]
  // expects.
  if (!result.rawToken) {
    throw new Error(
      "createInvitation returned an existing invitation; raw token unavailable",
    );
  }

  const invitation = await getInvitationById(result.invitationId);
  if (!invitation) {
    throw new Error("Failed to retrieve created invitation");
  }

  const inviteUrl = `${baseUrl}/invite/${result.rawToken}`;

  return {
    id: invitation.id,
    token: result.rawToken,
    email: invitation.email,
    role: invitation.role,
    entityType,
    entityId,
    entityName,
    inviteUrl,
  };
};

/**
 * Get invitation status by token
 */
export const getInvitationStatus = async (
  token: string,
): Promise<"pending" | "accepted" | "expired" | "revoked" | null> => {
  const invitation = await getInvitationByToken(token);
  return (
    (invitation?.status as "pending" | "accepted" | "expired" | "revoked") ||
    null
  );
};

/**
 * Create a test project in a specific office via the workspace service.
 * Used for access isolation testing where we need a citizen-owned project in a gov office.
 */
export const createTestProjectInOffice = async (params: {
  name: string;
  description?: string;
  officeId: string;
  createdBy: string;
}): Promise<{ id: string; name: string; slug: string }> => {
  const { name, description, officeId, createdBy } = params;
  const random = Math.random().toString(36).substring(2, 6);
  const slug = `${name.toLowerCase().replace(/\s+/g, "-")}-${random}`;

  const newProject = await createProject({
    name,
    slug,
    description,
    officeId,
    createdBy,
  });

  return { id: newProject.id, name: newProject.name, slug: newProject.slug };
};
