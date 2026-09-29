/**
 * Shared "is this publicly addressable?" predicates for the by-slug/by-id
 * public catalog endpoints.
 *
 * Organizations of a publicly-listed type (government, environmental planner)
 * are always browsable. Any other active org — a personal workspace, say — is
 * browsable only while it actually has something public to show: at least one
 * active, non-deleted project with `isPublic = true`. Without that fallback,
 * projects that `/api/public/projects` lists would 404 on their own catalog
 * pages. The private org tree is still not enumerable by slug/UUID, and the
 * owner's email never leaves the server (see `redactNonListedOrganization`).
 */

import {
  and,
  eq,
  exists,
  inArray,
  isNull,
  notInArray,
  or,
  type SQL,
} from "drizzle-orm";

import {
  type OrganizationType,
  office,
  organization,
  PUBLICLY_HIDDEN_OWNERSHIP_STATUSES,
  PUBLICLY_LISTED_ORG_TYPES,
  project,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

const publicProjectConditions = () =>
  and(
    eq(project.isPublic, true),
    eq(project.status, "active"),
    notInArray(project.ownershipStatus, PUBLICLY_HIDDEN_OWNERSHIP_STATUSES),
    isNull(project.deletedAt),
  );

/** Correlated on the outer `office` row. */
export const officeHasPublicProject = (): SQL =>
  exists(
    db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.officeId, office.id), publicProjectConditions())),
  );

/** Correlated on the outer `organization` row (outer query must NOT join `office`). */
export const organizationHasPublicProject = (): SQL =>
  exists(
    db
      .select({ id: project.id })
      .from(project)
      .innerJoin(office, eq(project.officeId, office.id))
      .where(
        and(
          eq(office.organizationId, organization.id),
          publicProjectConditions(),
        ),
      ),
  );

export const isPubliclyListedOrganizationType = (
  type: OrganizationType | string,
): boolean => PUBLICLY_LISTED_ORG_TYPES.includes(type as OrganizationType);

/** Org row passes when its type is listed OR the given fallback predicate holds. */
export const organizationIsBrowsable = (fallback: SQL): SQL =>
  or(inArray(organization.type, PUBLICLY_LISTED_ORG_TYPES), fallback) as SQL;

/**
 * Personal-workspace orgs carry the owner's email in `description`
 * ("Personal organization for <email>"). Strip it from anything returned for a
 * non-listed org type.
 */
export const redactNonListedOrganization = <
  T extends { type: string; description: string | null },
>(
  row: T,
): T => {
  if (isPubliclyListedOrganizationType(row.type)) {
    return row;
  }
  return { ...row, description: null };
};
