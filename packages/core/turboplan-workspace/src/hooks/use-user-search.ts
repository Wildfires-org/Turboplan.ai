"use client";

import { useMemo } from "react";

import useSWR from "swr";
import { useDebounceValue } from "usehooks-ts";

import { fetcher } from "@wildfires-org/turboplan-api-client";

// ============================================================================
// TYPES
// ============================================================================

/**
 * A searchable user from the database
 */
export type SearchableUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

/**
 * API response from /api/users/search
 */
type UserSearchResponse = {
  users: SearchableUser[];
  message?: string;
};

/**
 * Options for the useUserSearch hook
 */
export type UseUserSearchOptions = {
  /** Whether the search is enabled (default: true) */
  enabled?: boolean;
  /** Maximum number of results to return (default: 10) */
  limit?: number;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Minimum query length to trigger search (default: 3) */
  minQueryLength?: number;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_LIMIT = 10;
const DEFAULT_MIN_QUERY_LENGTH = 3;

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for searching users with debounced API calls.
 *
 * Features:
 * - 300ms debounce to prevent excessive API calls
 * - Minimum 3 character query requirement
 * - SWR caching for performance
 * - Configurable limit and debounce timing
 *
 * @example
 * ```tsx
 * const { users, isLoading, error } = useUserSearch(searchTerm, {
 *   enabled: isOpen,
 *   limit: 5,
 * });
 * ```
 */
export function useUserSearch(
  searchTerm: string,
  options: UseUserSearchOptions = {},
) {
  const {
    enabled = true,
    limit = DEFAULT_LIMIT,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
  } = options;

  // Debounce the search term
  const [debouncedTerm] = useDebounceValue(searchTerm, debounceMs);

  // Only search if enabled and query is long enough
  const shouldSearch = enabled && debouncedTerm.trim().length >= minQueryLength;

  // Build the API URL with query parameters
  const apiUrl = useMemo(() => {
    if (!shouldSearch) return null;
    const params = new URLSearchParams({
      q: debouncedTerm.trim(),
      limit: limit.toString(),
    });
    return `/api/users/search?${params.toString()}`;
  }, [shouldSearch, debouncedTerm, limit]);

  // Fetch users
  const { data, isLoading, error } = useSWR<UserSearchResponse>(
    apiUrl,
    fetcher,
    {
      // Don't revalidate on focus for search results
      revalidateOnFocus: false,
      // Keep previous data while loading new results
      keepPreviousData: true,
    },
  );

  return {
    /** Array of matching users */
    users: data?.users ?? [],
    /** Whether search is in progress */
    isLoading: shouldSearch && isLoading,
    /** Error from the API call */
    error,
    /** The debounced search term being used */
    debouncedTerm,
    /** Whether a search will be triggered (meets minimum length) */
    shouldSearch,
  };
}
