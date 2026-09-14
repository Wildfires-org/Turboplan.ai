import { and, eq } from "drizzle-orm";

import {
  type Organization,
  type OrganizationUser,
  organization,
  organizationUsers,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { type MemberRoleType } from "@wildfires-org/turboplan-rbac";

// Synced with @wildfires-org/turboplan-workspace for RBAC consistency
export type OrganizationUserRole = MemberRoleType;

export interface CreateOrganizationUserParams {
  userId: string;
  organizationId: string;
  role?: OrganizationUserRole;
}

/**
 * Add a user to an organization with a specific role
 * Default role is 'viewer'
 */
export async function createOrganizationUser(
  params: CreateOrganizationUserParams,
): Promise<unknown> {
  const { userId, organizationId, role = "viewer" } = params;

  return db.insert(organizationUsers).values({
    userId,
    organizationId,
    role,
  });
}

/**
 * Automatically assign owner role to user when they create an organization
 */
export async function assignOrganizationOwner(
  userId: string,
  organizationId: string,
): Promise<unknown> {
  return createOrganizationUser({
    userId,
    organizationId,
    role: "owner",
  });
}

/**
 * Get all users in an organization with their roles
 */
export async function getOrganizationUsers(
  organizationId: string,
): Promise<OrganizationUser[]> {
  return db
    .select()
    .from(organizationUsers)
    .where(eq(organizationUsers.organizationId, organizationId));
}

/**
 * Get all organizations for a user with their roles
 */
export async function getUserOrganizations(
  userId: string,
): Promise<OrganizationUser[]> {
  return db
    .select()
    .from(organizationUsers)
    .where(eq(organizationUsers.userId, userId));
}

/**
 * Remove user from organization
 */
export async function removeOrganizationUser(
  userId: string,
  organizationId: string,
): Promise<unknown> {
  return db
    .delete(organizationUsers)
    .where(
      and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, organizationId),
      ),
    );
}

// ============================================================================
// Advanced User-Organization Queries
// ============================================================================

/**
 * Get organizations for a user with their roles and full organization data
 */
export async function getUserOrganizationsWithRoles(userId: string): Promise<
  {
    organization: Organization;
    userRole: OrganizationUserRole;
    joinedAt: Date;
  }[]
> {
  try {
    const results = await db
      .select({
        organization: {
          id: organization.id,
          name: organization.name,
          shortName: organization.shortName,
          slug: organization.slug,
          slugHistory: organization.slugHistory,
          emailDomains: organization.emailDomains,
          description: organization.description,
          coverImageId: organization.coverImageId,
          country: organization.country,
          type: organization.type,
          status: organization.status,
          logoUrl: organization.logoUrl,
          documentLogoUrl: organization.documentLogoUrl,
          documentFooterText: organization.documentFooterText,
          documentFooterNote: organization.documentFooterNote,
          documentFooterLogoUrl: organization.documentFooterLogoUrl,
          createdBy: organization.createdBy,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt,
        },
        userRole: organizationUsers.role,
        joinedAt: organizationUsers.createdAt,
      })
      .from(organization)
      .innerJoin(
        organizationUsers,
        eq(organization.id, organizationUsers.organizationId),
      )
      .where(eq(organizationUsers.userId, userId));

    return results;
  } catch (error) {
    console.error("Failed to get user organizations with roles from database");
    throw error;
  }
}
