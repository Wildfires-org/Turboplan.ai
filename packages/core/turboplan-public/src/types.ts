/**
 * Public API Types
 *
 * Types inferred from Drizzle queries to ensure consistency
 * between API responses and frontend consumption.
 */

import type { getPublicOffice, getPublicOfficeBySlug } from "./queries/offices";
import type { getPublicOrganizationBySlug } from "./queries/organizations";

/**
 * Public organization for catalog display.
 * Inferred from getPublicOrganizationBySlug query.
 */
export type PublicOrganization = NonNullable<
  Awaited<ReturnType<typeof getPublicOrganizationBySlug>>
>;

/**
 * Public office for catalog display.
 * Inferred from getPublicOffice query.
 */
export type PublicOffice = NonNullable<
  Awaited<ReturnType<typeof getPublicOffice>>
>;

/**
 * Public office with organization info for catalog display.
 * Inferred from getPublicOfficeBySlug query.
 */
export type PublicOfficeWithOrg = NonNullable<
  Awaited<ReturnType<typeof getPublicOfficeBySlug>>
>;
