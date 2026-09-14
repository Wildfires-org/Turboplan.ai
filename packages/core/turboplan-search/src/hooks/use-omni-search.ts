"use client";

import { useMemo } from "react";

import useSWR from "swr";

import { publicFetcher } from "@wildfires-org/turboplan-api-client";

import type {
  GroupedSearchResults,
  SearchableEntityType,
  SearchResponse,
  SearchResult,
} from "../types";
import { ENTITY_TYPE_LABELS, MIN_QUERY_LENGTH } from "../types";

// ============================================================================
// TYPES
// ============================================================================

interface UseOmniSearchConfig {
  /** Maximum number of results to fetch (default: 10, max: 50) */
  limit?: number;
}

interface UseOmniSearchReturn {
  /** Raw search results from the API */
  results: SearchResult[];
  /** Results grouped by entity type, sorted by max similarity */
  groupedResults: GroupedSearchResults[];
  /** Total count of results */
  totalCount: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | undefined;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Groups search results by entity type and sorts groups by max similarity.
 * Results within each group maintain their original order (by similarity).
 */
const groupResultsByType = (
  results: SearchResult[],
): GroupedSearchResults[] => {
  if (results.length === 0) {
    return [];
  }

  // Group results by type
  const grouped = results.reduce<Record<SearchableEntityType, SearchResult[]>>(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<SearchableEntityType, SearchResult[]>,
  );

  // Convert to GroupedSearchResults array with max similarity
  const groupedArray: GroupedSearchResults[] = Object.entries(grouped).map(
    ([type, typeResults]) => {
      const entityType = type as SearchableEntityType;
      const maxSimilarity = Math.max(...typeResults.map((r) => r.similarity));

      return {
        type: entityType,
        label: ENTITY_TYPE_LABELS[entityType],
        results: typeResults,
        maxSimilarity,
      };
    },
  );

  // Sort groups by max similarity (highest first)
  return groupedArray.sort((a, b) => b.maxSimilarity - a.maxSimilarity);
};

/**
 * Builds the search API URL with query parameters
 */
const buildSearchUrl = (query: string, limit?: number): string => {
  const params = new URLSearchParams({ q: query });
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }
  return `/api/search?${params.toString()}`;
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for performing omni-search across organizations, offices, and projects.
 *
 * Uses SWR for data fetching with automatic caching and revalidation.
 * Only fetches when query length meets minimum requirement.
 * Returns both raw results and grouped results for flexible display.
 *
 * Note: Debouncing should be handled at the component level, not in this hook.
 *
 * @example
 * ```tsx
 * const { results, groupedResults, isLoading, error } = useOmniSearch(debouncedQuery);
 *
 * // Display grouped results
 * {groupedResults.map((group) => (
 *   <div key={group.type}>
 *     <h3>{group.label}</h3>
 *     {group.results.map((result) => (
 *       <SearchResultItem key={result.id} result={result} />
 *     ))}
 *   </div>
 * ))}
 * ```
 *
 * @param query - Search query string (debounced at component level)
 * @param config - Optional configuration for limit
 * @returns Object with results, groupedResults, loading states, and error
 */
export const useOmniSearch = (
  query: string,
  config: UseOmniSearchConfig = {},
): UseOmniSearchReturn => {
  const { limit } = config;

  // Trim the query and check if it meets minimum length
  const trimmedQuery = query.trim();
  const shouldFetch = trimmedQuery.length >= MIN_QUERY_LENGTH;

  // Build the SWR key - null when we shouldn't fetch
  const swrKey = shouldFetch ? buildSearchUrl(trimmedQuery, limit) : null;

  // Fetch search results using public fetcher (no auth required)
  const { data, isLoading, error } = useSWR<SearchResponse>(
    swrKey,
    publicFetcher,
    {
      // Keep previous data while loading new results for smoother UX
      keepPreviousData: true,
      // Disable automatic revalidation for search (user controls via typing)
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  // Extract results from response
  const results = data?.results ?? [];
  const totalCount = data?.totalCount ?? 0;

  // Group results by type (memoized to avoid recalculation on every render)
  const groupedResults = useMemo(() => groupResultsByType(results), [results]);

  return {
    results,
    groupedResults,
    totalCount,
    isLoading,
    error,
  };
};
