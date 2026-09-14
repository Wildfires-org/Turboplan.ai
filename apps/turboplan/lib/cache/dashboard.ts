/**
 * Centralized cache utilities for dashboard pages
 *
 * This module provides reusable cached data fetching functions to eliminate
 * duplication across dashboard pages and ensure consistent caching behavior.
 *
 * Split into separate files by entity type:
 * - organizations.ts - Organization cache utilities
 * - offices.ts - Office cache utilities
 * - projects.ts - Project cache utilities (server-side)
 */

import "server-only";

import { cache } from "react";

import { getProfileByUserId } from "@wildfires-org/turboplan-db/queries";

import { auth } from "@/app/(auth)/auth";

// ============================================================================
// Core Authentication & User Data
// ============================================================================

/**
 * Get the current user session with caching
 */
export const getCachedSession = cache(() => auth());

/**
 * Get user profile with caching
 */
export const getCachedUserProfile = cache((userId: string) =>
  getProfileByUserId(userId),
);

// ============================================================================
// Re-exports from entity-specific cache modules
// ============================================================================

// Offices
export { getValidatedOfficeBySlug } from "./offices";
// Organizations
export {
  canReadOrganizationAsMember,
  getValidatedOrganizationBySlug,
  type SlugValidationResult,
} from "./organizations";
// Projects
export {
  getCachedProject,
  getCachedProjectTemplates,
  getValidatedProjectBySlug,
} from "./projects";
