/**
 * Public Organization Queries
 *
 * Database queries for fetching organizations without authentication.
 */

import { and, asc, eq, inArray } from "drizzle-orm";

import {
  generatedImages,
  OrganizationStatus,
  organization,
  PUBLICLY_LISTED_ORG_TYPES,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

import {
  organizationHasPublicProject,
  organizationIsBrowsable,
  redactNonListedOrganization,
} from "./public-visibility";

/**
 * Shape for public organization display (catalog pages).
 *
 * NOTE: `coverImageUrl` comes from a leftJoin on `generatedImages`, so every
 * query using this shape must join on
 * `organization.coverImageId = generatedImages.id`.
 */
const publicOrganizationSelect = {
  id: organization.id,
  slug: organization.slug,
  name: organization.name,
  shortName: organization.shortName,
  description: organization.description,
  logoUrl: organization.logoUrl,
  coverImageUrl: generatedImages.imageUrl,
  type: organization.type,
} as const;

/**
 * Get a single active organization by slug.
 * Returns fields for public catalog display.
 */
export async function getPublicOrganizationBySlug(slug: string) {
  const result = await db
    .select(publicOrganizationSelect)
    .from(organization)
    .leftJoin(
      generatedImages,
      eq(organization.coverImageId, generatedImages.id),
    )
    .where(
      and(
        eq(organization.slug, slug),
        eq(organization.status, OrganizationStatus.ACTIVE),
        // Listed org types are always browsable; anything else only while it
        // has a public project to show. See public-visibility.ts.
        organizationIsBrowsable(organizationHasPublicProject()),
      ),
    )
    .limit(1);

  const org = result[0];
  return org ? redactNonListedOrganization(org) : null;
}

/**
 * Get all active publicly-listed organizations (government agencies +
 * environmental-planning firms). Returns minimal fields for dropdown display and
 * title generation.
 */
export async function getActiveGovernmentOrganizations() {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      shortName: organization.shortName,
      slug: organization.slug,
      logoUrl: organization.logoUrl,
      // `type` lets the signup modal filter to government-only submission
      // targets client-side while the catalog keeps showing both listed types.
      type: organization.type,
    })
    .from(organization)
    .where(
      and(
        eq(organization.status, OrganizationStatus.ACTIVE),
        inArray(organization.type, PUBLICLY_LISTED_ORG_TYPES),
      ),
    )
    .orderBy(asc(organization.name));
}
