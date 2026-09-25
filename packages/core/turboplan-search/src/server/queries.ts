// ============================================================================
// SEARCH QUERIES
// ============================================================================
// Trigram-based search queries using PostgreSQL's pg_trgm extension.
// Provides:
// - Substring matching via ILIKE (e.g., "ork" matches "stork")
// - Fuzzy/typo tolerance via % operator (e.g., "storc" matches "stork")
// Searches across organizations, offices, and projects with similarity ranking.
// ============================================================================

import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";

import {
  OfficeStatus,
  OrganizationStatus,
  ProjectStatus,
  PUBLICLY_HIDDEN_OWNERSHIP_STATUSES,
  PUBLICLY_LISTED_ORG_TYPES,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  office,
  organization,
  project,
} from "@wildfires-org/turboplan-db/schemas";

import type { BreadcrumbItem, SearchResult } from "../types";
import { DEFAULT_SEARCH_LIMIT, MIN_QUERY_LENGTH } from "../types";
import type { RawSearchResult, SearchQueryParams } from "./types";

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Sanitize user input for safe use in ILIKE patterns.
 * Escapes special characters that have meaning in LIKE patterns.
 *
 * @param query - Raw user input
 * @returns Sanitized string safe for ILIKE
 */
const sanitizeForIlike = (query: string): string => {
  return query
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/%/g, "\\%") // Escape percent signs
    .replace(/_/g, "\\_"); // Escape underscores
};

// ============================================================================
// URL BUILDERS
// ============================================================================

/**
 * Build the URL path for a search result based on entity type
 */
const buildEntityUrl = (result: RawSearchResult): string => {
  switch (result.type) {
    case "organization":
      return `/projects/${result.slug}`;
    case "office":
      return `/projects/${result.orgSlug}/${result.slug}`;
    case "project":
      return `/projects/${result.orgSlug}/${result.officeSlug}/${result.slug}`;
    case "template":
      return `/projects/${result.orgSlug}/${result.officeSlug}/templates/${result.slug}`;
    default:
      return "/projects";
  }
};

/**
 * Build breadcrumb trail for a search result
 */
const buildBreadcrumbs = (result: RawSearchResult): BreadcrumbItem[] => {
  const breadcrumbs: BreadcrumbItem[] = [];

  // Organizations have no breadcrumbs (they are the root)
  if (result.type === "organization") {
    return breadcrumbs;
  }

  // Add organization breadcrumb for offices and projects
  breadcrumbs.push({
    name: result.orgName,
    type: "organization",
    slug: result.orgSlug,
  });

  // Add office breadcrumb for projects and templates
  if (
    (result.type === "project" || result.type === "template") &&
    result.officeSlug &&
    result.officeName
  ) {
    breadcrumbs.push({
      name: result.officeName,
      type: "office",
      slug: result.officeSlug,
    });
  }

  return breadcrumbs;
};

/**
 * Transform raw database result into client-facing SearchResult
 */
const transformToSearchResult = (raw: RawSearchResult): SearchResult => ({
  id: raw.id,
  type: raw.type,
  // All entities display their name
  name: raw.type === "organization" ? raw.orgName : raw.name,
  description: raw.description,
  url: buildEntityUrl(raw),
  similarity: raw.similarity,
  breadcrumbs: buildBreadcrumbs(raw),
});

// ============================================================================
// SEARCH QUERIES
// ============================================================================

/**
 * Search organizations using trigram similarity.
 * Uses ILIKE for flexible substring matching and word_similarity for ranking.
 */
const searchOrganizations = async (
  query: string,
  ilikePattern: string,
  limit: number,
): Promise<RawSearchResult[]> => {
  // Similarity score: weighted combination of name (highest), shortName, description
  // word_similarity finds the most similar word in the text to the query
  const similarityScore = sql<number>`greatest(
    word_similarity(${query}, ${organization.name}) * 1.0,
    word_similarity(${query}, coalesce(${organization.shortName}, '')) * 0.9,
    word_similarity(${query}, coalesce(${organization.description}, '')) * 0.5
  )`;

  const results = await db
    .select({
      id: organization.id,
      type: sql<"organization">`'organization'`,
      name: organization.name,
      description: organization.description,
      slug: organization.slug,
      similarity: similarityScore,
      orgSlug: organization.slug,
      orgName: organization.name,
      officeSlug: sql<string | null>`null`,
      officeName: sql<string | null>`null`,
    })
    .from(organization)
    // Match using ILIKE for exact substring matching (e.g., "ork" → "stork")
    // OR the % operator for fuzzy/typo tolerance (e.g., "storc" → "stork").
    // Both approaches use the GIN trigram indexes for performance.
    .where(
      and(
        inArray(organization.type, PUBLICLY_LISTED_ORG_TYPES),
        eq(organization.status, OrganizationStatus.ACTIVE),
        sql`(
          ${organization.name} ILIKE ${ilikePattern} OR
          coalesce(${organization.shortName}, '') ILIKE ${ilikePattern} OR
          ${organization.description} ILIKE ${ilikePattern} OR
          ${organization.name} % ${query} OR
          coalesce(${organization.shortName}, '') % ${query} OR
          coalesce(${organization.description}, '') % ${query}
        )`,
      ),
    )
    .orderBy(desc(similarityScore))
    .limit(limit);

  return results;
};

/**
 * Search offices using trigram similarity.
 * Joins with organization to get breadcrumb data.
 */
const searchOffices = async (
  query: string,
  ilikePattern: string,
  limit: number,
): Promise<RawSearchResult[]> => {
  // Similarity score: weighted combination of name and description
  const similarityScore = sql<number>`greatest(
    word_similarity(${query}, ${office.name}) * 1.0,
    word_similarity(${query}, coalesce(${office.description}, '')) * 0.5
  )`;

  const results = await db
    .select({
      id: office.id,
      type: sql<"office">`'office'`,
      name: office.name,
      description: office.description,
      slug: office.slug,
      similarity: similarityScore,
      orgSlug: organization.slug,
      orgName: organization.name,
      officeSlug: sql<string | null>`null`,
      officeName: sql<string | null>`null`,
    })
    .from(office)
    .innerJoin(organization, sql`${office.organizationId} = ${organization.id}`)
    // Match using ILIKE for exact substring matching (e.g., "ork" → "stork")
    // OR the % operator for fuzzy/typo tolerance (e.g., "storc" → "stork").
    // Both approaches use the GIN trigram indexes for performance.
    .where(
      and(
        inArray(organization.type, PUBLICLY_LISTED_ORG_TYPES),
        eq(organization.status, OrganizationStatus.ACTIVE),
        eq(office.status, OfficeStatus.ACTIVE),
        sql`(
          ${office.name} ILIKE ${ilikePattern} OR
          ${office.description} ILIKE ${ilikePattern} OR
          ${office.name} % ${query} OR
          coalesce(${office.description}, '') % ${query}
        )`,
      ),
    )
    .orderBy(desc(similarityScore))
    .limit(limit);

  return results;
};

/**
 * Search projects using trigram similarity.
 * Joins with office and organization to get breadcrumb data.
 */
const searchProjects = async (
  query: string,
  ilikePattern: string,
  limit: number,
): Promise<RawSearchResult[]> => {
  // Similarity score: weighted combination of name and description
  const similarityScore = sql<number>`greatest(
    word_similarity(${query}, ${project.name}) * 1.0,
    word_similarity(${query}, coalesce(${project.description}, '')) * 0.5
  )`;

  const results = await db
    .select({
      id: project.id,
      type: sql<"project">`'project'`,
      name: project.name,
      description: project.description,
      slug: project.slug,
      similarity: similarityScore,
      orgSlug: organization.slug,
      orgName: organization.name,
      officeSlug: office.slug,
      officeName: office.name,
    })
    .from(project)
    .innerJoin(office, sql`${project.officeId} = ${office.id}`)
    .innerJoin(organization, sql`${office.organizationId} = ${organization.id}`)
    .where(
      and(
        eq(project.isPublic, true),
        eq(project.status, ProjectStatus.ACTIVE),
        eq(project.isTemplate, false),
        notInArray(project.ownershipStatus, PUBLICLY_HIDDEN_OWNERSHIP_STATUSES),
        inArray(organization.type, PUBLICLY_LISTED_ORG_TYPES),
        eq(organization.status, OrganizationStatus.ACTIVE),
        eq(office.status, OfficeStatus.ACTIVE),
        sql`(
          ${project.name} ILIKE ${ilikePattern} OR
          ${project.description} ILIKE ${ilikePattern} OR
          ${project.name} % ${query} OR
          coalesce(${project.description}, '') % ${query}
        )`,
      ),
    )
    .orderBy(desc(similarityScore))
    .limit(limit);

  return results;
};

/**
 * Search templates (projects with isTemplate=true) using trigram similarity.
 * Joins with office and organization to get breadcrumb data.
 */
const searchTemplates = async (
  query: string,
  ilikePattern: string,
  limit: number,
): Promise<RawSearchResult[]> => {
  const similarityScore = sql<number>`greatest(
    word_similarity(${query}, ${project.name}) * 1.0,
    word_similarity(${query}, coalesce(${project.description}, '')) * 0.5
  )`;

  const results = await db
    .select({
      id: project.id,
      type: sql<"template">`'template'`,
      name: project.name,
      description: project.description,
      slug: project.slug,
      similarity: similarityScore,
      orgSlug: organization.slug,
      orgName: organization.name,
      officeSlug: office.slug,
      officeName: office.name,
    })
    .from(project)
    .innerJoin(office, sql`${project.officeId} = ${office.id}`)
    .innerJoin(organization, sql`${office.organizationId} = ${organization.id}`)
    .where(
      and(
        eq(project.isPublic, true),
        eq(project.status, ProjectStatus.ACTIVE),
        eq(project.isTemplate, true),
        notInArray(project.ownershipStatus, PUBLICLY_HIDDEN_OWNERSHIP_STATUSES),
        inArray(organization.type, PUBLICLY_LISTED_ORG_TYPES),
        eq(organization.status, OrganizationStatus.ACTIVE),
        eq(office.status, OfficeStatus.ACTIVE),
        sql`(
          ${project.name} ILIKE ${ilikePattern} OR
          ${project.description} ILIKE ${ilikePattern} OR
          ${project.name} % ${query} OR
          coalesce(${project.description}, '') % ${query}
        )`,
      ),
    )
    .orderBy(desc(similarityScore))
    .limit(limit);

  return results;
};

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

/**
 * Search across all entities (organizations, offices, projects)
 * Returns results sorted by relevance score
 *
 * Uses PostgreSQL pg_trgm extension for:
 * - Flexible substring matching (e.g., "stor" matches "stork", "ork" matches "stork")
 * - word_similarity() for relevance scoring
 * - GIN indexes with gin_trgm_ops for efficient lookups
 *
 * @param params - Search parameters (query, limit)
 * @returns Array of search results sorted by relevance
 */
export const searchEntities = async ({
  query,
  limit = DEFAULT_SEARCH_LIMIT,
}: SearchQueryParams): Promise<SearchResult[]> => {
  // Handle empty or too-short queries
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }

  // Sanitize query for ILIKE pattern and create the pattern
  const sanitizedQuery = sanitizeForIlike(trimmedQuery);
  const ilikePattern = `%${sanitizedQuery}%`;

  // Run all searches in parallel
  const [orgResults, officeResults, projectResults, templateResults] =
    await Promise.all([
      searchOrganizations(trimmedQuery, ilikePattern, limit),
      searchOffices(trimmedQuery, ilikePattern, limit),
      searchProjects(trimmedQuery, ilikePattern, limit),
      searchTemplates(trimmedQuery, ilikePattern, limit),
    ]);

  // Combine all results
  const allRawResults: RawSearchResult[] = [
    ...orgResults,
    ...officeResults,
    ...projectResults,
    ...templateResults,
  ];

  // Sort by similarity (highest first) and limit
  const sortedResults = allRawResults
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  // Transform to client-facing format
  return sortedResults.map(transformToSearchResult);
};
