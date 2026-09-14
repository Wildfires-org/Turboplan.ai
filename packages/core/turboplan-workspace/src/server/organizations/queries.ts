import { and, eq, inArray, or, sql } from "drizzle-orm";

import {
  OfficeStatus,
  type Organization,
  OrganizationStatus,
  OrganizationType,
  office,
  organization,
  PUBLICLY_LISTED_ORG_TYPES,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { EntityType, MemberRole } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import {
  generateSlug,
  generateUniqueSlug,
  isValidSlug,
} from "@wildfires-org/turboplan-utils/server";

import type { SlugLookupResult } from "../../types";
import { emitWorkspaceAnalytics } from "../analytics";
import type { OfficeWithAccess, OrganizationWithOffices } from "./types";

export async function getOrganizationById(
  id: string,
): Promise<Organization | null> {
  try {
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, id));
    return org || null;
  } catch (error) {
    console.error("Failed to get organization from database");
    throw error;
  }
}

export async function getOrganizationByName(
  name: string,
): Promise<Organization | null> {
  try {
    const [org] = await db
      .select()
      .from(organization)
      .where(sql`LOWER(${organization.name}) = LOWER(${name})`);
    return org || null;
  } catch (error) {
    console.error("Failed to get organization by name from database");
    throw error;
  }
}

/**
 * Get organization by slug (checks both current and historical slugs)
 * Returns the organization and whether it was found via historical slug
 */
export async function getOrganizationBySlug(
  slug: string,
): Promise<SlugLookupResult<Organization>> {
  try {
    const [org] = await db
      .select()
      .from(organization)
      .where(
        or(
          eq(organization.slug, slug),
          sql`${organization.slugHistory}::jsonb @> ${JSON.stringify([slug])}::jsonb`,
        ),
      );

    if (!org) {
      return { entity: null, foundViaHistory: false };
    }

    // Check if found via history (current slug doesn't match)
    const foundViaHistory = org.slug !== slug;

    return { entity: org, foundViaHistory };
  } catch (error) {
    console.error("Failed to get organization by slug from database");
    throw error;
  }
}

/**
 * Check if an organization slug already exists (in current slug or slugHistory)
 * Uses single query to check both. Optionally exclude a specific organization ID (for updates)
 */
async function isOrganizationSlugTaken(
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const { entity } = await getOrganizationBySlug(slug);
  if (entity && entity.id !== excludeId) {
    return true;
  }
  return false;
}

/**
 * Generate a unique slug for an organization
 * If the base slug is taken, appends a short unique ID
 */
async function generateUniqueOrganizationSlug(name: string): Promise<string> {
  const baseSlug = generateSlug(name);

  if (!baseSlug) {
    return generateUniqueSlug(name);
  }

  const isTaken = await isOrganizationSlugTaken(baseSlug);
  if (!isTaken) {
    return baseSlug;
  }

  // Slug is taken, generate unique one
  return generateUniqueSlug(name);
}

/**
 * Get all organizations a user has access to via RBAC
 * Includes organizations where user has:
 * - Direct organization membership
 * - Office membership (upward read access to parent org)
 * - Project membership (upward read access to org via office)
 *
 * This uses the RBAC service to traverse the entity hierarchy
 */
export async function getUserAccessibleOrganizations(
  userId: string,
): Promise<Organization[]> {
  try {
    // Use RBAC service to get all memberships (org, office, project)
    const rbacService = getRBACService();
    const allMemberships = await rbacService.getUserMemberships(userId);

    // Extract unique organization IDs from all memberships
    const orgIds = new Set<string>();

    // Collect direct organization memberships
    allMemberships
      .filter((m) => m.entityType === EntityType.ORGANIZATION)
      .forEach((m) => orgIds.add(m.entityId));

    // Collect office and project memberships that need ancestor lookup
    const officeAndProjectMemberships = allMemberships.filter(
      (m) =>
        m.entityType === EntityType.OFFICE ||
        m.entityType === EntityType.PROJECT,
    );

    // Use RBAC's batch ancestor lookup (centralizes hierarchy logic)
    if (officeAndProjectMemberships.length > 0) {
      const ancestorsMap = await rbacService.getAncestorsBatch(
        officeAndProjectMemberships.map((m) => ({
          entityId: m.entityId,
          entityType: m.entityType,
        })),
      );

      // Extract organization ancestors from the map
      for (const ancestors of ancestorsMap.values()) {
        for (const ancestor of ancestors) {
          if (ancestor.type === EntityType.ORGANIZATION) {
            orgIds.add(ancestor.id);
          }
        }
      }
    }

    // Fetch organization details for all accessible organizations
    if (orgIds.size === 0) {
      return [];
    }

    const organizations = await db
      .select()
      .from(organization)
      .where(inArray(organization.id, Array.from(orgIds)));

    return organizations;
  } catch (error) {
    console.error("Failed to get accessible organizations from database");
    throw error;
  }
}

/**
 * Get all publicly-listed organizations (government agencies + environmental-
 * planning firms). Feeds the authenticated org-list merge and the /with-offices
 * sidebar surface, where these org types are visible to every authenticated
 * user regardless of membership.
 */
export async function getGovernmentOrganizations(): Promise<Organization[]> {
  try {
    const organizations = await db
      .select()
      .from(organization)
      .where(inArray(organization.type, PUBLICLY_LISTED_ORG_TYPES));
    return organizations;
  } catch (error) {
    console.error("Failed to get publicly-listed organizations from database");
    throw error;
  }
}

export async function createOrganization({
  name,
  shortName,
  slug,
  description,
  country,
  type = OrganizationType.PERSONAL,
  status = OrganizationStatus.ACTIVE,
  logoUrl,
  emailDomains,
  createdBy,
}: {
  name: string;
  shortName?: string;
  slug?: string;
  description?: string;
  country?: string;
  type?: OrganizationType;
  status?: OrganizationStatus;
  logoUrl?: string;
  emailDomains?: string[];
  createdBy: string;
}): Promise<Organization> {
  try {
    const now = new Date();
    // Generate slug from name if not provided
    const finalSlug = slug || (await generateUniqueOrganizationSlug(name));

    const [newOrg] = await db
      .insert(organization)
      .values({
        name,
        shortName,
        slug: finalSlug,
        description,
        country,
        type,
        status,
        logoUrl,
        ...(emailDomains !== undefined && { emailDomains }),
        createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Keyed by the creating user, not the org, so this joins the same person
    // funnel as user_signed_up / onboarding_completed. Personal orgs minted
    // inside createUser (turboplan-db) do NOT come through here — that is
    // deliberate: a personal workspace is an artifact of signup, already
    // covered by user_signed_up, and counting it would double every account.
    emitWorkspaceAnalytics({
      distinctId: createdBy,
      event: "organization_created",
      properties: {
        organization_id: newOrg.id,
        organization_type: newOrg.type,
      },
    });

    return newOrg;
  } catch (error) {
    console.error("Failed to create organization in database");
    throw error;
  }
}

export async function updateOrganization({
  id,
  name,
  shortName,
  slug: newSlug,
  description,
  country,
  type,
  status,
  logoUrl,
  emailDomains,
  documentLogoUrl,
  documentFooterText,
  documentFooterNote,
  documentFooterLogoUrl,
}: {
  id: string;
  name?: string;
  shortName?: string;
  slug?: string;
  description?: string;
  country?: string;
  type?: OrganizationType;
  status?: OrganizationStatus;
  logoUrl?: string;
  emailDomains?: string[];
  documentLogoUrl?: string;
  documentFooterText?: string;
  documentFooterNote?: string;
  documentFooterLogoUrl?: string;
}): Promise<unknown> {
  try {
    // Validate slug format if provided
    if (newSlug !== undefined && !isValidSlug(newSlug)) {
      throw new Error(`Invalid slug format: "${newSlug}"`);
    }

    // Use transaction to prevent race conditions during slug updates
    return await db.transaction(async (tx) => {
      // Build base update data
      const updateData: Partial<typeof organization.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (name !== undefined) updateData.name = name;
      if (shortName !== undefined) updateData.shortName = shortName;
      if (description !== undefined) updateData.description = description;
      if (country !== undefined) updateData.country = country;
      if (type !== undefined) updateData.type = type;
      if (status !== undefined) updateData.status = status;
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
      if (emailDomains !== undefined) updateData.emailDomains = emailDomains;
      if (documentLogoUrl !== undefined) {
        updateData.documentLogoUrl = documentLogoUrl;
      }
      if (documentFooterText !== undefined) {
        updateData.documentFooterText = documentFooterText;
      }
      if (documentFooterNote !== undefined) {
        updateData.documentFooterNote = documentFooterNote;
      }
      if (documentFooterLogoUrl !== undefined) {
        updateData.documentFooterLogoUrl = documentFooterLogoUrl;
      }

      // Handle slug change with history tracking
      if (newSlug !== undefined) {
        const [current] = await tx
          .select()
          .from(organization)
          .where(eq(organization.id, id));

        if (current && current.slug !== newSlug) {
          // Check slug availability inside transaction to prevent TOCTOU race
          const [existingWithSlug] = await tx
            .select({ id: organization.id })
            .from(organization)
            .where(
              or(
                eq(organization.slug, newSlug),
                sql`${organization.slugHistory}::jsonb @> ${JSON.stringify([newSlug])}::jsonb`,
              ),
            );
          if (existingWithSlug && existingWithSlug.id !== id) {
            throw new Error(
              `Slug "${newSlug}" is already taken or was previously used`,
            );
          }

          // Add current slug to history (unless it's already there from a previous rename back)
          const updatedHistory = current.slugHistory.includes(current.slug)
            ? current.slugHistory
            : [...current.slugHistory, current.slug];

          // Remove new slug from history if it exists (returning to a previous slug)
          const finalHistory = updatedHistory.filter((s) => s !== newSlug);

          updateData.slug = newSlug;
          updateData.slugHistory = finalHistory;
        } else if (current) {
          updateData.slug = newSlug;
        }
      }

      return await tx
        .update(organization)
        .set(updateData)
        .where(eq(organization.id, id));
    });
  } catch (error) {
    console.error("Failed to update organization in database");
    throw error;
  }
}

/**
 * Get all government organizations with their offices and user access indicators.
 * Used by the sidebar org/office search dropdown.
 *
 * Query strategy:
 * 1. Fetch user's RBAC memberships (3 parallel SELECTs via getUserMemberships)
 *    — runs in parallel with step 2
 * 2. Fetch all active government orgs + user's accessible non-gov orgs (single query)
 * 3. Fetch all active offices for matched organizations
 * 4. If user has project memberships, resolve parent offices via getAncestorsBatch
 *
 * Access logic:
 * - Org-level membership grants access to the org and all its offices (inherited)
 * - Office-level membership grants access to that specific office
 * - Project-level membership grants access to the parent office (upward read)
 */
export async function getOrganizationsWithOffices(
  userId: string,
): Promise<OrganizationWithOffices[]> {
  try {
    const rbacService = getRBACService();

    // 1. Fetch memberships first — the org query depends on which
    // organizations the user can reach (directly or via office/project
    // membership inheritance), so we resolve accessible org IDs before
    // filtering organizations at the DB level.
    const allMemberships = await rbacService.getUserMemberships(userId);

    // Build lookup maps for fast access checks
    const orgMembershipRoles = new Map<string, string>();
    const officeMembershipRoles = new Map<string, string>();

    for (const m of allMemberships) {
      if (m.entityType === EntityType.ORGANIZATION) {
        orgMembershipRoles.set(m.entityId, m.role);
      } else if (m.entityType === EntityType.OFFICE) {
        officeMembershipRoles.set(m.entityId, m.role);
      }
    }

    // Seed accessible org IDs with direct organization memberships.
    const accessibleOrgIds = new Set<string>(orgMembershipRoles.keys());

    // For office and project memberships, resolve accessible orgs (and, for
    // project memberships, upward read access to the parent office) via a
    // single batch ancestor lookup.
    const officeAndProjectMemberships = allMemberships.filter(
      (m) =>
        m.entityType === EntityType.OFFICE ||
        m.entityType === EntityType.PROJECT,
    );

    if (officeAndProjectMemberships.length > 0) {
      const ancestorsMap = await rbacService.getAncestorsBatch(
        officeAndProjectMemberships.map((m) => ({
          entityId: m.entityId,
          entityType: m.entityType,
        })),
      );

      for (const [, ancestors] of ancestorsMap) {
        for (const ancestor of ancestors) {
          // Mark the parent org as accessible for the switcher dropdown.
          if (ancestor.type === EntityType.ORGANIZATION) {
            accessibleOrgIds.add(ancestor.id);
          }
          // Project membership grants upward read access to parent office.
          // Office memberships have no office-type ancestors, so this only
          // fires for project memberships.
          if (
            ancestor.type === EntityType.OFFICE &&
            !officeMembershipRoles.has(ancestor.id)
          ) {
            // Use "viewer" as the effective role for inherited project-level access
            officeMembershipRoles.set(ancestor.id, "viewer");
          }
        }
      }
    }

    // 2. Fetch active organizations the user can reach: all publicly-listed
    // orgs (government + environmental planning — visible to every
    // authenticated user in the sidebar merge) plus any org resolved above.
    // Guard against an empty ID set — inArray must not be called with an
    // empty array.
    const orgAccessFilter =
      accessibleOrgIds.size > 0
        ? or(
            inArray(organization.type, PUBLICLY_LISTED_ORG_TYPES),
            inArray(organization.id, Array.from(accessibleOrgIds)),
          )
        : inArray(organization.type, PUBLICLY_LISTED_ORG_TYPES);

    const orgs = await db
      .select()
      .from(organization)
      .where(
        and(
          eq(organization.status, OrganizationStatus.ACTIVE),
          orgAccessFilter,
        ),
      );

    if (orgs.length === 0) {
      return [];
    }

    const orgIds = orgs.map((o) => o.id);

    // 3. Fetch all active offices for those organizations
    const offices = await db
      .select()
      .from(office)
      .where(
        and(
          inArray(office.organizationId, orgIds),
          eq(office.status, OfficeStatus.ACTIVE),
        ),
      );

    // Group offices by organization
    const officesByOrgId = new Map<string, typeof offices>();
    for (const o of offices) {
      const existing = officesByOrgId.get(o.organizationId) ?? [];
      existing.push(o);
      officesByOrgId.set(o.organizationId, existing);
    }

    // Build the response
    const result: OrganizationWithOffices[] = orgs.map((org) => {
      const hasOrgAccess = orgMembershipRoles.has(org.id);
      const orgOffices = officesByOrgId.get(org.id) ?? [];

      const officesWithAccess: OfficeWithAccess[] = orgOffices
        .map((o) => {
          // Office is accessible if user has org-level membership (inherited)
          // or direct office/project membership. Publicly-listed org types
          // (government + environmental planning) grant every authenticated user
          // a default viewer view of their offices.
          const directRole = officeMembershipRoles.get(o.id) ?? null;
          const isPubliclyListedOrg = PUBLICLY_LISTED_ORG_TYPES.includes(
            org.type as OrganizationType,
          );
          const hasAccess =
            isPubliclyListedOrg || hasOrgAccess || directRole !== null;

          return {
            id: o.id,
            slug: o.slug,
            name: o.name,
            hasAccess,
            role: hasOrgAccess
              ? (orgMembershipRoles.get(org.id) ?? null)
              : (directRole ??
                (isPubliclyListedOrg ? MemberRole.VIEWER : null)),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        id: org.id,
        slug: org.slug,
        name: org.name,
        shortName: org.shortName,
        logoUrl: org.logoUrl,
        type: org.type,
        hasAccess:
          hasOrgAccess || officesWithAccess.some((office) => office.hasAccess),
        offices: officesWithAccess,
      };
    });

    // Sort orgs alphabetically by name
    result.sort((a, b) => a.name.localeCompare(b.name));

    return result;
  } catch (error) {
    console.error(
      "Failed to get organizations with offices from database:",
      error,
    );
    throw error;
  }
}

export async function deleteOrganization(id: string): Promise<unknown> {
  try {
    return await db.delete(organization).where(eq(organization.id, id));
  } catch (error) {
    console.error("Failed to delete organization from database");
    throw error;
  }
}
