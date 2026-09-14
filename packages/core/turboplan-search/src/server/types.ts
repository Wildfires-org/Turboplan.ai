// ============================================================================
// SERVER-SIDE TYPES
// ============================================================================
// Raw database result shapes used internally by search queries.
// These are transformed into the client-facing SearchResult type.
// ============================================================================

import type { SearchableEntityType } from "../types";

/**
 * Raw search result from a single entity query
 * Before transformation into SearchResult with URL/breadcrumbs
 */
export interface RawSearchResult {
  /** Entity UUID */
  id: string;
  /** Entity type */
  type: SearchableEntityType;
  /** Entity name */
  name: string;
  /** Entity description (nullable) */
  description: string | null;
  /** Entity slug for URL construction */
  slug: string;
  /** Full-text search relevance score */
  similarity: number;
  // Breadcrumb data (nullable based on entity type)
  /** Organization slug (always present) */
  orgSlug: string;
  /** Organization name for display (always present) */
  orgName: string;
  /** Office slug (null for organizations) */
  officeSlug: string | null;
  /** Office name (null for organizations) */
  officeName: string | null;
}

/**
 * Parameters for the search query function
 */
export interface SearchQueryParams {
  /** Search query string */
  query: string;
  /** Maximum number of results to return */
  limit?: number;
}
