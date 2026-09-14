/**
 * Organization cache utilities
 */

import "server-only";

import { cache } from "react";

import {
  OrganizationType,
  PUBLICLY_LISTED_ORG_TYPES,
} from "@wildfires-org/turboplan-db/types";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import { getOrganizationBySlug } from "@wildfires-org/turboplan-workspace/server";

import { AppUrls } from "@/lib/nav/urls";

// ============================================================================
// Individual Entity Fetchers
// ============================================================================

/**
 * Get organization by slug with caching
 * Checks both current and historical slugs, returns entity and foundViaHistory flag
 */
export const getCachedOrganizationBySlug = cache(async (slug: string) => {
  return getOrganizationBySlug(slug);
});

// ============================================================================
// Slug-Based Validation (with redirect support)
// ============================================================================

/**
 * Result type for slug-based validation with optional redirect
 */
export type SlugValidationResult<T> = {
  data: T | null;
  redirectTo?: string; // URL to redirect to if found via historical slug
};

/**
 * Validate and get organization data by slug with access check
 * Returns data and optional redirect URL if found via historical slug
 */
export const getValidatedOrganizationBySlug = cache(
  async (
    userId: string,
    orgSlug: string,
  ): Promise<
    SlugValidationResult<
      NonNullable<Awaited<ReturnType<typeof getOrganizationBySlug>>["entity"]>
    >
  > => {
    // Single query to check both current and historical slugs
    const { entity: organization, foundViaHistory } =
      await getCachedOrganizationBySlug(orgSlug);

    if (!organization) {
      return { data: null };
    }

    // Check access using RBAC with the organization ID
    const rbacService = getRBACService();
    const accessResult = await rbacService.checkPermission(
      userId,
      organization.id,
      EntityType.ORGANIZATION,
      Action.READ,
    );

    if (!accessResult.allowed) {
      // Any authenticated user can read publicly-listed organizations
      // (government agencies + environmental-planning firms).
      if (
        !PUBLICLY_LISTED_ORG_TYPES.includes(
          organization.type as OrganizationType,
        )
      ) {
        return { data: null };
      }
    }

    // Build redirect URL if found via historical slug
    const redirectTo = foundViaHistory
      ? AppUrls.organization(organization.slug)
      : undefined;

    return { data: organization, redirectTo };
  },
);

/**
 * Check whether a user is an actual member of the organization (RBAC READ).
 *
 * Unlike `getValidatedOrganizationBySlug`, this does NOT grant the government
 * "any authenticated user can read" exception. Use it to gate the org-level
 * management surfaces (overview, members, settings, billing, signing) so that
 * non-members never see those tabs or their contents.
 */
export const canReadOrganizationAsMember = cache(
  async (userId: string, organizationId: string): Promise<boolean> => {
    const accessResult = await getRBACService().checkPermission(
      userId,
      organizationId,
      EntityType.ORGANIZATION,
      Action.READ,
    );

    return accessResult.allowed;
  },
);
