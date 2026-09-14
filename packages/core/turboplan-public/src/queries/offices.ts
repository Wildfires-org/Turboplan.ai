/**
 * Public Office Queries
 *
 * Database queries for fetching offices without authentication.
 */

import { and, asc, count, eq, inArray } from "drizzle-orm";

import {
  generatedImages,
  OfficeStatus,
  OrganizationStatus,
  office,
  organization,
  PUBLICLY_LISTED_ORG_TYPES,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

import {
  officeHasPublicProject,
  organizationIsBrowsable,
} from "./public-visibility";

/**
 * Shape for public office display (catalog pages).
 *
 * NOTE: `coverImageUrl` comes from a leftJoin on `generatedImages`, so every
 * query using this shape must join on `office.coverImageId = generatedImages.id`.
 */
const publicOfficeSelect = {
  id: office.id,
  name: office.name,
  slug: office.slug,
  organizationId: office.organizationId,
  description: office.description,
  logoUrl: office.logoUrl,
  coverImageUrl: generatedImages.imageUrl,
} as const;

/**
 * Get a single office (used for type inference).
 */
export async function getPublicOffice(officeId: string) {
  const result = await db
    .select(publicOfficeSelect)
    .from(office)
    .leftJoin(generatedImages, eq(office.coverImageId, generatedImages.id))
    .where(eq(office.id, officeId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get all active offices for an organization.
 * Returns minimal fields for dropdown display.
 */
export async function getOfficesByOrganizationId(organizationId: string) {
  return db
    .select({
      id: office.id,
      name: office.name,
      slug: office.slug,
    })
    .from(office)
    .where(
      and(
        eq(office.organizationId, organizationId),
        eq(office.status, OfficeStatus.ACTIVE),
      ),
    )
    .orderBy(asc(office.name));
}

/**
 * Get paginated active offices for an organization.
 * Returns full fields for catalog display with pagination support.
 */
export async function getPaginatedOfficesByOrganizationId(
  organizationId: string,
  options?: {
    limit?: number;
    offset?: number;
    onlyWithPublicProjects?: boolean;
  },
) {
  const whereCondition = and(
    eq(office.organizationId, organizationId),
    eq(office.status, OfficeStatus.ACTIVE),
    // Non-listed orgs (personal workspaces) expose only offices that hold a
    // public project, so the rest of the private tree stays unenumerable.
    options?.onlyWithPublicProjects ? officeHasPublicProject() : undefined,
  );

  const limit = options?.limit;
  const offset = options?.offset ?? 0;

  const query = db
    .select(publicOfficeSelect)
    .from(office)
    .leftJoin(generatedImages, eq(office.coverImageId, generatedImages.id))
    .where(whereCondition)
    .orderBy(asc(office.name))
    .offset(offset);

  const [totalResult, offices] = await Promise.all([
    db.select({ count: count() }).from(office).where(whereCondition),
    limit !== undefined ? query.limit(limit) : query,
  ]);

  return {
    items: offices,
    total: totalResult[0]?.count ?? 0,
  };
}

/**
 * Get a single active office by organization slug + office slug.
 * Returns public office fields with organization info for catalog display.
 */
export async function getPublicOfficeBySlug(
  orgSlug: string,
  officeSlug: string,
) {
  const result = await db
    .select({
      ...publicOfficeSelect,
      organizationSlug: organization.slug,
      organizationName: organization.name,
      organizationLogoUrl: organization.logoUrl,
      organizationType: organization.type,
    })
    .from(office)
    .innerJoin(organization, eq(office.organizationId, organization.id))
    .leftJoin(generatedImages, eq(office.coverImageId, generatedImages.id))
    .where(
      and(
        eq(organization.slug, orgSlug),
        eq(office.slug, officeSlug),
        eq(office.status, OfficeStatus.ACTIVE),
        // Offices under active, listed orgs are always browsable; under any
        // other org only while this office holds a public project. Keeps the
        // private org→office tree unwalkable by slug. See public-visibility.ts.
        eq(organization.status, OrganizationStatus.ACTIVE),
        organizationIsBrowsable(officeHasPublicProject()),
      ),
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get all active offices from publicly-listed organizations (government agencies
 * + environmental-planning firms). Returns office name with organization info
 * for title generation.
 */
export async function getActiveGovernmentOffices() {
  return db
    .select({
      id: office.id,
      name: office.name,
      organizationId: office.organizationId,
      organizationName: organization.name,
      organizationShortName: organization.shortName,
    })
    .from(office)
    .innerJoin(organization, eq(office.organizationId, organization.id))
    .where(
      and(
        eq(office.status, OfficeStatus.ACTIVE),
        inArray(organization.type, PUBLICLY_LISTED_ORG_TYPES),
      ),
    )
    .orderBy(asc(office.name));
}
