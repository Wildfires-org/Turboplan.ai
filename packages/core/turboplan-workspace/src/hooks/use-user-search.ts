"use client";

import useSWR from "swr";
import { useDebounceValue } from "usehooks-ts";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type { EntityTypeType } from "@wildfires-org/turboplan-rbac";

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
 * What a user search is for. An entity scope searches `/api/users/search`
 * within that entity's organization tree (strangers only on an exact email);
 * `"admin"` uses the admin-only global search.
 */
export type UserSearchScope =
  | { entityType: EntityTypeType; entityId: string }
  | "admin";

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

const SCOPE_PARAM: Record<EntityTypeType, string> = {
  organization: "organizationId",
  office: "officeId",
  project: "projectId",
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build the search URL for `scope`. Exported for unit tests.
 */
export const buildUserSearchUrl = (
  scope: UserSearchScope,
  query: string,
  limit: number,
): string => {
  const params = new URLSearchParams({ q: query, limit: limit.toString() });

  if (scope === "admin") {
    return `/api/admin/users/search?${params.toString()}`;
  }

  params.set(SCOPE_PARAM[scope.entityType], scope.entityId);
  return `/api/users/search?${params.toString()}`;
};

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
 * const { users, isLoading, error } = useUserSearch(
 *   searchTerm,
 *   { entityType: "project", entityId: projectId },
 *   { enabled: isOpen, limit: 5 },
 * );
 * ```
 */
export function useUserSearch(
  searchTerm: string,
  scope: UserSearchScope,
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

  // Build the API URL with query parameters (SWR keys on the string)
  const apiUrl = shouldSearch
    ? buildUserSearchUrl(scope, debouncedTerm.trim(), limit)
    : null;

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
