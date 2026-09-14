/**
 * Project cache utilities (server-side)
 */

import "server-only";

import { cache } from "react";

import { getGeneratedImageById } from "@wildfires-org/turboplan-db/queries";
import {
  OrganizationType,
  PUBLICLY_LISTED_ORG_TYPES,
} from "@wildfires-org/turboplan-db/types";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import {
  getOfficeBySlug,
  getOrganizationBySlug,
  getProjectById,
  getProjectBySlug,
  getProjectsByOffice,
  isDraftHiddenFromUser,
} from "@wildfires-org/turboplan-workspace/server";

import { AppUrls } from "@/lib/nav/urls";
import { getCachedOfficeBySlug } from "./offices";
import {
  getCachedOrganizationBySlug,
  type SlugValidationResult,
} from "./organizations";

// ============================================================================
// Individual Entity Fetchers
// ============================================================================

/**
 * Get project by ID with caching
 */
export const getCachedProject = cache(async (projId: string) => {
  return getProjectById(projId);
});

/**
 * Get project by slug with caching
 * Checks both current and historical slugs, returns entity and foundViaHistory flag
 */
const getCachedProjectBySlug = cache(
  async (organizationSlug: string, officeSlug: string, projectSlug: string) => {
    return getProjectBySlug(organizationSlug, officeSlug, projectSlug);
  },
);

// ============================================================================
// Specialized Fetchers
// ============================================================================

/**
 * Get project templates for an office with caching
 */
export const getCachedProjectTemplates = cache((officeId: string) =>
  getProjectsByOffice(officeId, { isTemplate: true }),
);

// ============================================================================
// Slug-Based Validation (with redirect support)
// ============================================================================

/**
 * Validate and get project data by slugs with full access validation
 * Returns data and optional redirect URL if found via historical slug
 */
export const getValidatedProjectBySlug = cache(
  async (
    userId: string,
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): Promise<
    SlugValidationResult<{
      organization: NonNullable<
        Awaited<ReturnType<typeof getOrganizationBySlug>>["entity"]
      >;
      office: NonNullable<
        Awaited<ReturnType<typeof getOfficeBySlug>>["entity"]
      >;
      project: NonNullable<
        Awaited<ReturnType<typeof getProjectBySlug>>["entity"]
      >;
      coverImage: Awaited<ReturnType<typeof getGeneratedImageById>> | null;
      /**
       * True when the user has a real RBAC membership on the project
       * (direct or inherited). False when they only got through via the
       * public-government-project bypass. UI should use this to hide
       * private/internal data from non-members.
       */
      isMember: boolean;
    }>
  > => {
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

    // Single query to resolve project (current or historical)
    const { entity: project, foundViaHistory: projectRedirect } =
      await getCachedProjectBySlug(organization.slug, office.slug, projectSlug);

    if (!project) {
      return { data: null };
    }

    // Check access using RBAC with the project ID
    const rbacService = getRBACService();
    const accessResult = await rbacService.checkPermission(
      userId,
      project.id,
      EntityType.PROJECT,
      Action.READ,
    );

    if (!accessResult.allowed) {
      // Any authenticated user can read public projects in publicly-listed
      // organizations (government agencies + environmental-planning firms).
      const isPublicListedOrgProject =
        PUBLICLY_LISTED_ORG_TYPES.includes(
          organization.type as OrganizationType,
        ) && project.isPublic;
      if (!isPublicListedOrgProject) {
        return { data: null };
      }
    }

    // Draft visibility: creator-only in government orgs; in non-gov orgs any
    // member with RBAC READ access may see drafts. A user who only reached the
    // project via the public-gov bypass (READ denied) never sees others' drafts.
    const isGovOrg = organization.type === OrganizationType.GOVERNMENT;
    if (
      isDraftHiddenFromUser(project, userId, isGovOrg, accessResult.allowed)
    ) {
      return { data: null };
    }

    // Fetch cover image if project has one
    let coverImage = null;
    if (project.coverImageId) {
      try {
        coverImage = await getGeneratedImageById(project.coverImageId);
      } catch (error) {
        console.error("Failed to fetch cover image:", error);
      }
    }

    // Build redirect URL if any slug was historical
    const redirectTo =
      orgRedirect || officeRedirect || projectRedirect
        ? AppUrls.project(organization.slug, office.slug, project.slug)
        : undefined;

    return {
      data: {
        organization,
        office,
        project,
        coverImage,
        isMember: accessResult.allowed,
      },
      redirectTo,
    };
  },
);
