import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import {
  type Office,
  OrganizationType,
  office,
  officeUsers,
  organization,
  PUBLICLY_LISTED_ORG_TYPES,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import {
  generateSlug,
  generateUniqueSlug,
  isValidSlug,
} from "@wildfires-org/turboplan-utils/server";

import type { SlugLookupResult } from "../../types";
import type {
  CreateOfficeRequest,
  OfficeStatus,
  UpdateOfficeRequest,
} from "./types";

export async function getOfficeById(id: string): Promise<Office | null> {
  try {
    const [result] = await db.select().from(office).where(eq(office.id, id));
    return result || null;
  } catch (error) {
    console.error("Failed to get office from database");
    throw error;
  }
}

/**
 * Get office by slug (checks both current and historical slugs)
 * Returns the office and whether it was found via historical slug
 */
export async function getOfficeBySlug(
  organizationSlug: string,
  officeSlug: string,
): Promise<SlugLookupResult<Office>> {
  try {
    const [result] = await db
      .select({ office })
      .from(office)
      .innerJoin(organization, eq(office.organizationId, organization.id))
      .where(
        and(
          eq(organization.slug, organizationSlug),
          or(
            eq(office.slug, officeSlug),
            sql`${office.slugHistory}::jsonb @> ${JSON.stringify([officeSlug])}::jsonb`,
          ),
        ),
      );

    if (!result?.office) {
      return { entity: null, foundViaHistory: false };
    }

    // Check if found via history (current slug doesn't match)
    const foundViaHistory = result.office.slug !== officeSlug;

    return { entity: result.office, foundViaHistory };
  } catch (error) {
    console.error("Failed to get office by slug from database");
    throw error;
  }
}

export async function getOfficeByName(
  name: string,
  organizationId: string,
): Promise<Office | null> {
  try {
    const [result] = await db
      .select()
      .from(office)
      .where(
        and(
          sql`LOWER(${office.name}) = LOWER(${name})`,
          eq(office.organizationId, organizationId),
        ),
      );
    return result || null;
  } catch (error) {
    console.error("Failed to get office by name from database");
    throw error;
  }
}

/**
 * Check if an office slug already exists within an organization (in current slug or slugHistory)
 * Uses single query to check both. Optionally exclude a specific office ID (for updates)
 */
async function isOfficeSlugTaken(
  organizationId: string,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(office)
    .where(
      and(
        eq(office.organizationId, organizationId),
        or(
          eq(office.slug, slug),
          sql`${office.slugHistory}::jsonb @> ${JSON.stringify([slug])}::jsonb`,
        ),
      ),
    );

  if (existing && existing.id !== excludeId) {
    return true;
  }
  return false;
}

/**
 * Generate a unique slug for an office within an organization
 * If the base slug is taken, appends a short unique ID
 */
async function generateUniqueOfficeSlug(
  organizationId: string,
  name: string,
): Promise<string> {
  const baseSlug = generateSlug(name);

  if (!baseSlug) {
    return generateUniqueSlug(name);
  }

  const isTaken = await isOfficeSlugTaken(organizationId, baseSlug);
  if (!isTaken) {
    return baseSlug;
  }

  // Slug is taken, generate unique one
  return generateUniqueSlug(name);
}

export async function getOfficesByOrganization(
  organizationId: string,
  options: {
    status?: OfficeStatus;
    offset?: number;
    limit?: number;
    sortBy?: "name" | "createdAt" | "updatedAt" | "status";
    sortOrder?: "asc" | "desc";
  } = {},
): Promise<Office[]> {
  try {
    const { sortBy = "createdAt", sortOrder = "desc" } = options;
    const sortFn = sortOrder === "asc" ? asc : desc;

    // Build conditions array
    const conditions = [eq(office.organizationId, organizationId)];

    if (options.status) {
      conditions.push(eq(office.status, options.status));
    }

    // Get sort column
    let sortColumn;
    switch (sortBy) {
      case "name":
        sortColumn = office.name;
        break;
      case "status":
        sortColumn = office.status;
        break;
      case "updatedAt":
        sortColumn = office.updatedAt;
        break;
      default:
        sortColumn = office.createdAt;
        break;
    }

    // Build complete query in one chain with all options
    const baseQuery = db
      .select()
      .from(office)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(sortFn(sortColumn));

    // Apply pagination in the same chain if provided
    if (
      typeof options.offset === "number" &&
      typeof options.limit === "number"
    ) {
      return await baseQuery.offset(options.offset).limit(options.limit);
    } else if (typeof options.offset === "number") {
      return await baseQuery.offset(options.offset);
    } else if (typeof options.limit === "number") {
      return await baseQuery.limit(options.limit);
    }

    return await baseQuery;
  } catch (error) {
    console.error("Failed to get offices by organization from database");
    throw error;
  }
}

export async function createOffice(data: CreateOfficeRequest): Promise<Office> {
  try {
    // Generate slug from name if not provided
    const finalSlug =
      data.slug ||
      (await generateUniqueOfficeSlug(data.organizationId, data.name));

    return db.transaction(async (tx) => {
      const now = new Date();

      // Create the office
      const [newOffice] = await tx
        .insert(office)
        .values({
          name: data.name,
          slug: finalSlug,
          description: data.description,
          organizationId: data.organizationId,
          createdBy: data.createdBy,
          status: data.status || "active",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Automatically assign the creator as owner in the join table
      await tx.insert(officeUsers).values({
        userId: data.createdBy,
        officeId: newOffice.id,
        role: "owner",
      });

      return newOffice;
    });
  } catch (error) {
    console.error("Failed to create office in database:", error);
    throw error;
  }
}

export async function updateOffice(data: UpdateOfficeRequest): Promise<void> {
  try {
    // Validate slug format if provided
    if (data.slug !== undefined && !isValidSlug(data.slug)) {
      throw new Error(`Invalid slug format: "${data.slug}"`);
    }

    // Use transaction to prevent race conditions during slug updates
    await db.transaction(async (tx) => {
      const updateData: Partial<typeof office.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (data.name !== undefined) {
        updateData.name = data.name;
      }

      if (data.description !== undefined) {
        updateData.description = data.description;
      }

      if (data.status !== undefined) {
        updateData.status = data.status;
      }

      if (data.documentLogoUrl !== undefined) {
        updateData.documentLogoUrl = data.documentLogoUrl;
      }

      if (data.documentFooterText !== undefined) {
        updateData.documentFooterText = data.documentFooterText;
      }

      if (data.documentFooterNote !== undefined) {
        updateData.documentFooterNote = data.documentFooterNote;
      }

      if (data.documentFooterLogoUrl !== undefined) {
        updateData.documentFooterLogoUrl = data.documentFooterLogoUrl;
      }

      // Handle slug change with history tracking
      if (data.slug !== undefined) {
        const [current] = await tx
          .select()
          .from(office)
          .where(eq(office.id, data.id));

        if (current && current.slug !== data.slug) {
          // Check if new slug is available (excluding self)
          const isTaken = await isOfficeSlugTaken(
            current.organizationId,
            data.slug,
            data.id,
          );
          if (isTaken) {
            throw new Error(
              `Slug "${data.slug}" is already taken or was previously used`,
            );
          }

          // Add current slug to history (unless it's already there)
          const updatedHistory = current.slugHistory.includes(current.slug)
            ? current.slugHistory
            : [...current.slugHistory, current.slug];

          // Remove new slug from history if it exists (returning to a previous slug)
          const finalHistory = updatedHistory.filter((s) => s !== data.slug);

          updateData.slug = data.slug;
          updateData.slugHistory = finalHistory;
        } else if (current) {
          updateData.slug = data.slug;
        }
      }

      await tx.update(office).set(updateData).where(eq(office.id, data.id));
    });
  } catch (error) {
    console.error("Failed to update office in database");
    throw error;
  }
}

export async function deleteOffice(id: string): Promise<void> {
  try {
    await db.delete(office).where(eq(office.id, id));
  } catch (error) {
    console.error("Failed to delete office from database");
    throw error;
  }
}

export async function getOfficeWithRelations(id: string) {
  try {
    const result = await db
      .select({
        office: office,
        organization: organization,
        creator: user,
      })
      .from(office)
      .leftJoin(organization, eq(office.organizationId, organization.id))
      .leftJoin(user, eq(office.createdBy, user.id))
      .where(eq(office.id, id));

    return result[0] || null;
  } catch (error) {
    console.error("Failed to get office with relations from database");
    throw error;
  }
}

/**
 * Get all offices a user has access to via RBAC for a given organization
 * Includes offices where user has:
 * - Direct office membership
 * - Project membership (upward read access to parent office)
 * - Organization membership (downward access to all offices in the org)
 */
export async function getUserAccessibleOffices(
  userId: string,
  organizationId: string,
  organizationType?: string,
): Promise<Office[]> {
  try {
    // Publicly-listed organizations (government + environmental planning) are
    // publicly visible — all their offices are accessible. If the caller already
    // knows the org type, skip the extra query.
    const resolvedType =
      organizationType ??
      (
        await db
          .select({ type: organization.type })
          .from(organization)
          .where(eq(organization.id, organizationId))
      )[0]?.type;

    if (
      resolvedType !== undefined &&
      PUBLICLY_LISTED_ORG_TYPES.includes(resolvedType as OrganizationType)
    ) {
      return await getOfficesByOrganization(organizationId);
    }

    // Use RBAC service to get all memberships
    const rbacService = getRBACService();
    const allMemberships = await rbacService.getUserMemberships(userId);

    // Early exit: Check organization membership first
    const hasOrgMembership = allMemberships.some(
      (m) =>
        m.entityId === organizationId &&
        m.entityType === EntityType.ORGANIZATION,
    );

    if (hasOrgMembership) {
      // User has organization access, return all offices in the org
      return await getOfficesByOrganization(organizationId);
    }

    // Collect all office IDs the user can access
    const accessibleOfficeIds = new Set<string>();

    // Add direct office memberships
    allMemberships
      .filter((m) => m.entityType === EntityType.OFFICE)
      .forEach((m) => accessibleOfficeIds.add(m.entityId));

    // Use RBAC's batch ancestor lookup for project memberships (centralizes hierarchy logic)
    const projectMemberships = allMemberships.filter(
      (m) => m.entityType === EntityType.PROJECT,
    );

    if (projectMemberships.length > 0) {
      const ancestorsMap = await rbacService.getAncestorsBatch(
        projectMemberships.map((m) => ({
          entityId: m.entityId,
          entityType: m.entityType,
        })),
      );

      // Extract office ancestors from the map
      for (const ancestors of ancestorsMap.values()) {
        for (const ancestor of ancestors) {
          if (ancestor.type === EntityType.OFFICE) {
            accessibleOfficeIds.add(ancestor.id);
          }
        }
      }
    }

    // Fetch office details for all accessible offices, filtered by organization
    if (accessibleOfficeIds.size === 0) {
      return [];
    }

    const offices = await db
      .select()
      .from(office)
      .where(
        and(
          inArray(office.id, Array.from(accessibleOfficeIds)),
          eq(office.organizationId, organizationId),
        ),
      );

    return offices;
  } catch (error) {
    console.error("Failed to get accessible offices from database:", error);
    throw error;
  }
}
