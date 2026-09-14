import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "../db-client";
import {
  type Organization,
  OrganizationStatus,
  OrganizationType,
  organization,
} from "../schemas";

/**
 * Organization shape used for email-based affiliation detection. Covers both
 * government agencies and environmental-planning firms — the `type` field lets
 * callers map a match to the correct user role.
 */
export interface OrganizationWithEmailDomains {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  type: OrganizationType;
  emailDomains: string[];
}

/**
 * Get all active organizations whose type participates in email-domain
 * affiliation detection (government agencies + environmental-planning firms),
 * including their configured email domains. Used to detect a user's affiliation
 * (and derived role) from their email.
 *
 * Domain matching is done in application code (not SQL) because the number of
 * such organizations is small and `email_domains` is stored as JSON.
 */
export async function getActiveOrganizationsWithEmailDomains(): Promise<
  OrganizationWithEmailDomains[]
> {
  try {
    return (await db
      .select({
        id: organization.id,
        name: organization.name,
        shortName: organization.shortName,
        slug: organization.slug,
        type: organization.type,
        emailDomains: organization.emailDomains,
      })
      .from(organization)
      .where(
        and(
          eq(organization.status, OrganizationStatus.ACTIVE),
          inArray(organization.type, [
            OrganizationType.GOVERNMENT,
            OrganizationType.ENVIRONMENTAL_PLANNER,
          ]),
        ),
      )
      .orderBy(asc(organization.name))) as OrganizationWithEmailDomains[];
  } catch (error) {
    console.error("Failed to get organizations with email domains");
    throw error;
  }
}

/**
 * Get a single organization by id, or null when it does not exist.
 */
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
