// ============================================================================
// SEARCHABLE ENTITY TYPES
// ============================================================================

/**
 * Types of entities that can be searched
 */
export type SearchableEntityType =
  | "organization"
  | "office"
  | "project"
  | "template";

/**
 * Display labels for each entity type
 */
export const ENTITY_TYPE_LABELS: Record<SearchableEntityType, string> = {
  organization: "Organizations",
  office: "Offices",
  project: "Projects",
  template: "Templates",
} as const;

// ============================================================================
// BREADCRUMB TYPES
// ============================================================================

/**
 * A single breadcrumb item representing a parent entity in the hierarchy
 */
export interface BreadcrumbItem {
  /** Display name of the entity */
  name: string;
  /** Entity type for icon display */
  type: SearchableEntityType;
  /** URL slug of the entity */
  slug: string;
}

// ============================================================================
// SEARCH RESULT TYPES
// ============================================================================

/**
 * A single search result with all display information
 */
export interface SearchResult {
  /** Unique identifier for the entity */
  id: string;
  /** Type of entity (organization, office, project) */
  type: SearchableEntityType;
  /** Display name of the entity */
  name: string;
  /** Optional description text */
  description: string | null;
  /** URL path to navigate to this entity */
  url: string;
  /** Full-text search relevance score (higher = more relevant) */
  similarity: number;
  /** Breadcrumb trail showing parent entities */
  breadcrumbs: BreadcrumbItem[];
}

/**
 * Grouped search results by entity type for display
 */
export interface GroupedSearchResults {
  /** Entity type for this group */
  type: SearchableEntityType;
  /** Human-readable label for the group (e.g., "Organizations") */
  label: string;
  /** Results in this group */
  results: SearchResult[];
  /** Highest similarity score in this group (used for sorting groups) */
  maxSimilarity: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * API response shape for search endpoint
 */
export interface SearchResponse {
  /** Array of search results */
  results: SearchResult[];
  /** Original query string */
  query: string;
  /** Total number of results found */
  totalCount: number;
}

/**
 * Error response from search API
 */
export interface SearchErrorResponse {
  /** Error message */
  error: string;
  /** Error code for client handling */
  code: "INVALID_QUERY" | "QUERY_TOO_SHORT" | "INTERNAL_ERROR";
}

// ============================================================================
// SEARCH PARAMS
// ============================================================================

/**
 * Parameters for search API request
 */
export interface SearchParams {
  /** Search query string (min 2 characters) */
  q: string;
  /** Maximum number of results to return (default: 10, max: 50) */
  limit?: number;
}

/**
 * Minimum query length required for search
 */
export const MIN_QUERY_LENGTH = 2;

/**
 * Default number of results to return
 */
export const DEFAULT_SEARCH_LIMIT = 10;

/**
 * Maximum number of results that can be requested
 */
export const MAX_SEARCH_LIMIT = 50;
