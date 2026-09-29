/**
 * Public Project Queries
 *
 * Database queries for fetching project data without authentication.
 */

import { and, desc, eq, isNull, notInArray, type SQL } from "drizzle-orm";

import {
  office,
  organization,
  PUBLICLY_HIDDEN_OWNERSHIP_STATUSES,
  project,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

export type PublicProjectFilters = {
  organizationId?: string;
  organizationSlug?: string;
  officeId?: string;
  officeSlug?: string;
};

export type PublicTemplateFilters = {
  organizationId?: string;
  organizationSlug?: string;
  officeId?: string;
  officeSlug?: string;
};

/**
 * Shared query builder for public projects/templates.
 */
function queryPublicEntries(
  isTemplate: boolean,
  filters: {
    organizationId?: string;
    organizationSlug?: string;
    officeId?: string;
    officeSlug?: string;
  } = {},
) {
  const conditions: SQL[] = [
    eq(project.isPublic, true),
    eq(project.status, "active"),
    eq(project.isTemplate, isTemplate),
    notInArray(project.ownershipStatus, PUBLICLY_HIDDEN_OWNERSHIP_STATUSES),
    isNull(project.deletedAt),
  ];

  if (filters.organizationId) {
    conditions.push(eq(organization.id, filters.organizationId));
  }
  if (filters.organizationSlug) {
    conditions.push(eq(organization.slug, filters.organizationSlug));
  }
  if (filters.officeId) {
    conditions.push(eq(office.id, filters.officeId));
  }
  if (filters.officeSlug) {
    conditions.push(eq(office.slug, filters.officeSlug));
  }

  return db
    .select({
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      coverImageId: project.coverImageId,
      updatedAt: project.updatedAt,
      createdAt: project.createdAt,
      officeId: office.id,
      officeName: office.name,
      officeSlug: office.slug,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
    })
    .from(project)
    .innerJoin(office, eq(project.officeId, office.id))
    .innerJoin(organization, eq(office.organizationId, organization.id))
    .where(and(...conditions));
}

/**
 * Get all public projects with optional filters.
 * Returns projects that are public, active, and not templates.
 */
export async function getPublicProjects(filters: PublicProjectFilters = {}) {
  return queryPublicEntries(false, filters).orderBy(desc(project.updatedAt));
}

/**
 * Get public templates with optional filters and limit.
 * Returns projects that are public, active, and templates.
 */
export async function getPublicTemplates(
  filters: PublicTemplateFilters = {},
  limit?: number,
) {
  const query = queryPublicEntries(true, filters).orderBy(
    desc(project.createdAt),
  );
  if (limit) {
    return query.limit(limit);
  }
  return query;
}

/**
 * Get a project by organization, office, and project slugs.
 * Does not filter by public status - caller should check. Applications under
 * review (see PUBLICLY_HIDDEN_OWNERSHIP_STATUSES) are never returned, since
 * every caller is a public read path.
 */
export async function getProjectBySlugs(
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
) {
  const result = await db
    .select({
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      coverImageId: project.coverImageId,
      isPublic: project.isPublic,
      status: project.status,
      isTemplate: project.isTemplate,
      startDate: project.startDate,
      endDate: project.endDate,
      hiddenModules: project.hiddenModules,
      privateModules: project.privateModules,
      moduleOrder: project.moduleOrder,
      updatedAt: project.updatedAt,
      createdAt: project.createdAt,
      officeId: office.id,
      officeName: office.name,
      officeSlug: office.slug,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
    })
    .from(project)
    .innerJoin(office, eq(project.officeId, office.id))
    .innerJoin(organization, eq(office.organizationId, organization.id))
    .where(
      and(
        eq(organization.slug, orgSlug),
        eq(office.slug, officeSlug),
        eq(project.slug, projectSlug),
        notInArray(project.ownershipStatus, PUBLICLY_HIDDEN_OWNERSHIP_STATUSES),
        isNull(project.deletedAt),
      ),
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Get project with office info for auto-responder.
 * Returns office name and createdBy user (office owner) for generating responses.
 */
export async function getProjectWithOfficeForAutoResponse(projectId: string) {
  const result = await db
    .select({
      projectId: project.id,
      officeName: office.name,
      officeOwnerId: office.createdBy,
    })
    .from(project)
    .innerJoin(office, eq(project.officeId, office.id))
    .where(and(eq(project.id, projectId), isNull(project.deletedAt)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}
