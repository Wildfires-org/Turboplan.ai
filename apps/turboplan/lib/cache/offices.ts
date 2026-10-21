/**
 * Office cache utilities
 */

import "server-only";

import { cache } from "react";

import {
  OrganizationType,
  PUBLICLY_LISTED_ORG_TYPES,
} from "@wildfires-org/turboplan-db/types";
import {
  Action,
  type ActionType,
  EntityType,
} from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import { getOfficeBySlug } from "@wildfires-org/turboplan-workspace/server";
import {
  type ClientOffice,
  type ClientOrganization,
  withoutLetterheadGrid,
} from "@wildfires-org/turboplan-workspace/types";

import { isRoutableSlugPath } from "@/lib/nav/route-slugs";
import { AppUrls } from "@/lib/nav/urls";
import {
  getCachedOrganizationBySlug,
  type SlugValidationResult,
} from "./organizations";

// ============================================================================
// Individual Entity Fetchers
// ============================================================================

/**
 * Get office by slug with caching
 * Checks both current and historical slugs, returns entity and foundViaHistory flag.
 * The office comes without its default letterhead grid (storage URLs): pages
 * pass it on to client components.
 */
export const getCachedOfficeBySlug = cache(
  async (
    organizationSlug: string,
    officeSlug: string,
  ): Promise<{ entity: ClientOffice | null; foundViaHistory: boolean }> => {
    const { entity, foundViaHistory } = await getOfficeBySlug(
      organizationSlug,
      officeSlug,
    );
    return { entity: entity && withoutLetterheadGrid(entity), foundViaHistory };
  },
);

// ============================================================================
// Slug-Based Validation (with redirect support)
// ============================================================================

/**
 * Validate and get office data by slugs with full access validation
 * Returns data and optional redirect URL if found via historical slug
 */
export const getValidatedOfficeBySlug = cache(
  async (
    userId: string,
    orgSlug: string,
    officeSlug: string,
  ): Promise<
    SlugValidationResult<{
      organization: ClientOrganization;
      office: ClientOffice;
    }>
  > => {
    // Malformed or reserved slugs (`/wp-admin.php`, `/organizations`) can't
    // name an entity: skip the DB. Layouts 404 on them; this covers the
    // pages' generateMetadata, which runs alongside the layouts.
    if (!isRoutableSlugPath({ orgSlug, officeSlug })) {
      return { data: null };
    }

    // Single query to resolve organization (current or historical)
    const { entity: organization, foundViaHistory: orgRedirect } =
      await getCachedOrganizationBySlug(orgSlug);

    if (!organization) {
      return { data: null };
    }

    // Single query to resolve office (current or historical)
    const { entity: office, foundViaHistory: officeRedirect } =
      await getCachedOfficeBySlug(organization.slug, officeSlug);

    if (!office) {
      return { data: null };
    }

    // Check access using RBAC with the office ID
    const rbacService = getRBACService();
    const accessResult = await rbacService.checkPermission(
      userId,
      office.id,
      EntityType.OFFICE,
      Action.READ,
    );

    if (!accessResult.allowed) {
      // Any authenticated user can read offices in publicly-listed organizations
      // (government agencies + environmental-planning firms).
      if (
        !PUBLICLY_LISTED_ORG_TYPES.includes(
          organization.type as OrganizationType,
        )
      ) {
        return { data: null };
      }
    }

    // Build redirect URL if any slug was historical
    const redirectTo =
      orgRedirect || officeRedirect
        ? AppUrls.office(organization.slug, office.slug)
        : undefined;

    return { data: { organization, office }, redirectTo };
  },
);

/**
 * Actions the user may perform on an office (RBAC), resolved in one pass.
 *
 * Government offices are readable by any authenticated user, so the office
 * page uses this to hide management actions (edit office, new project,
 * invite members) from viewers the API would reject.
 */
export const getOfficeAllowedActions = cache(
  async (userId: string, officeId: string): Promise<ActionType[]> => {
    const { actions } = await getRBACService().getAllowedActions(
      userId,
      officeId,
      EntityType.OFFICE,
    );
    return actions;
  },
);
