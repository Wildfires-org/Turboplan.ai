// ============================================================================
// USER SEARCH QUERIES
// ============================================================================
// Trigram-based user search using PostgreSQL's pg_trgm extension.
// Searches across user email and profile firstName/lastName with similarity ranking.
// ============================================================================

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { office, profile, project, user } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { EntityType } from "@wildfires-org/turboplan-rbac";

import {
  isMemberOfSearchBranch,
  type UserSearchBranch,
  type UserSearchEntityScope,
} from "./scope";
import type { UserSearchResult } from "./types";

/**
 * Who a search may fuzzy-match: members of one scope's branch of the
 * hierarchy, or (admin only) every account.
 */
export type UserSearchVisibility = UserSearchBranch | { global: true };

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_USER_SEARCH_LIMIT = 10;
export const MAX_USER_SEARCH_LIMIT = 50;
export const MIN_USER_QUERY_LENGTH = 3;

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Sanitize user input for safe use in ILIKE patterns.
 * Escapes special characters that have meaning in LIKE patterns.
 */
const sanitizeForIlike = (query: string): string => {
  return query
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/%/g, "\\%") // Escape percent signs
    .replace(/_/g, "\\_"); // Escape underscores
};

/**
 * The hierarchy ids of a search scope, or `null` when the entity does not
 * exist (or the project is soft-deleted).
 */
export const getSearchScopeBranch = async (
  scope: UserSearchEntityScope,
): Promise<UserSearchBranch | null> => {
  if (scope.entityType === EntityType.ORGANIZATION) {
    return { organizationId: scope.entityId };
  }

  if (scope.entityType === EntityType.OFFICE) {
    const [row] = await db
      .select({ officeId: office.id, organizationId: office.organizationId })
      .from(office)
      .where(eq(office.id, scope.entityId))
      .limit(1);
    return row ?? null;
  }

  const [row] = await db
    .select({
      projectId: project.id,
      officeId: project.officeId,
      organizationId: office.organizationId,
    })
    .from(project)
    .innerJoin(office, eq(office.id, project.officeId))
    .where(and(eq(project.id, scope.entityId), isNull(project.deletedAt)))
    .limit(1);
  return row ?? null;
};

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

/**
 * Search users by email or name using trigram similarity.
 *
 * Uses PostgreSQL pg_trgm extension for:
 * - Flexible substring matching via ILIKE
 * - Fuzzy/typo tolerance via % operator
 * - word_similarity() for relevance scoring
 *
 * With a branch visibility, fuzzy matches are limited to members of that
 * scope's branch (see `isMemberOfSearchBranch`); anyone else is returned only on an exact
 * (case-insensitive) full-email match, so partial input cannot enumerate the
 * whole user base. `{ global: true }` is reserved for the admin router.
 *
 * @param query - Search query string (minimum 3 characters)
 * @param limit - Maximum number of results (default 10)
 * @param visibility - Which users the fuzzy match may reach
 * @returns Array of matching users sorted by relevance
 */
export const searchUsers = async (
  query: string,
  limit: number,
  visibility: UserSearchVisibility,
): Promise<UserSearchResult[]> => {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < MIN_USER_QUERY_LENGTH) {
    return [];
  }

  const sanitizedQuery = sanitizeForIlike(trimmedQuery);
  const ilikePattern = `%${sanitizedQuery}%`;

  // Similarity score: weighted combination of email (highest), firstName, lastName
  // word_similarity finds the most similar word in the text to the query
  const similarityScore = sql<number>`greatest(
    word_similarity(${trimmedQuery}, ${user.email}) * 1.0,
    word_similarity(${trimmedQuery}, coalesce(${profile.firstName}, '')) * 0.9,
    word_similarity(${trimmedQuery}, coalesce(${profile.lastName}, '')) * 0.9,
    word_similarity(${trimmedQuery}, coalesce(${profile.firstName}, '') || ' ' || coalesce(${profile.lastName}, '')) * 0.95
  )`;

  // Match using ILIKE for exact substring matching
  // OR the % operator for fuzzy/typo tolerance
  const fuzzyMatch = sql`(
    ${user.email} ILIKE ${ilikePattern} OR
    coalesce(${profile.firstName}, '') ILIKE ${ilikePattern} OR
    coalesce(${profile.lastName}, '') ILIKE ${ilikePattern} OR
    (coalesce(${profile.firstName}, '') || ' ' || coalesce(${profile.lastName}, '')) ILIKE ${ilikePattern} OR
    ${user.email} % ${trimmedQuery} OR
    coalesce(${profile.firstName}, '') % ${trimmedQuery} OR
    coalesce(${profile.lastName}, '') % ${trimmedQuery}
  )`;

  const matchesVisibleUser =
    "global" in visibility
      ? fuzzyMatch
      : sql`((${fuzzyMatch} AND ${isMemberOfSearchBranch(visibility)}) OR lower(${user.email}) = ${trimmedQuery.toLowerCase()})`;

  const results = await db
    .select({
      id: user.id,
      email: user.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
      similarity: similarityScore,
    })
    .from(user)
    .leftJoin(profile, sql`${user.id} = ${profile.userId}`)
    .where(matchesVisibleUser)
    .orderBy(desc(similarityScore))
    .limit(limit);

  return results.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    avatarUrl: r.avatarUrl,
    similarity: r.similarity,
  }));
};
