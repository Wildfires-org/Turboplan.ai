import { useCallback, useMemo } from "react";

import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import type {
  OfficeSearchParams,
  OfficeWithProjectCounts,
} from "@wildfires-org/turboplan-workspace/types";

interface UseOfficesOptions {
  organizationSlug: string | null;
  filters?: OfficeSearchParams;
}

interface OfficesError extends Error {
  status?: number;
}

const officesFetcher = async (
  url: string,
): Promise<OfficeWithProjectCounts[]> => {
  try {
    return await fetcher<OfficeWithProjectCounts[]>(url);
  } catch (error: unknown) {
    const e = error as { status?: number; info?: string; message?: string };
    const err = new Error(
      e.info || e.message || "Failed to fetch offices",
    ) as OfficesError;
    err.status = e.status || 500;

    if (e.status === 401) {
      err.message = "Unauthorized";
    } else if (e.status === 403 || e.status === 404) {
      err.message = "Access denied or resource not found";
    }

    throw err;
  }
};

export function useOffices({ organizationSlug, filters }: UseOfficesOptions) {
  const swrKey = useMemo(() => {
    if (!organizationSlug) return null;

    const searchParams = new URLSearchParams();
    searchParams.set("organizationSlug", organizationSlug);

    if (filters?.status) searchParams.set("status", filters.status);
    if (typeof filters?.offset === "number") {
      searchParams.set("offset", filters.offset.toString());
    }
    if (typeof filters?.limit === "number") {
      searchParams.set("limit", filters.limit.toString());
    }
    if (filters?.sortBy) searchParams.set("sortBy", filters.sortBy);
    if (filters?.sortOrder) searchParams.set("sortOrder", filters.sortOrder);

    return `/api/offices?${searchParams.toString()}`;
  }, [organizationSlug, filters]);

  const {
    data: offices,
    error,
    isLoading,
    mutate,
  } = useSWR<OfficeWithProjectCounts[], OfficesError>(swrKey, officesFetcher, {
    // Fetched by the sidebar switcher on every page; office lists change via
    // explicit mutations, not in the background.
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    onError: (err) => {
      console.error("Error fetching offices:", err);
    },
  });

  // Consider "loading" if SWR is loading OR if we haven't received any data yet
  const isInitialLoading = isLoading || offices === undefined;

  const fetchOffices = useCallback(
    (newFilters?: OfficeSearchParams) => {
      if (!organizationSlug) return mutate();
      if (newFilters) {
        // For new filters, we need to create a new key and trigger a fetch
        const searchParams = new URLSearchParams();
        searchParams.set("organizationSlug", organizationSlug);

        if (newFilters?.status) searchParams.set("status", newFilters.status);
        if (typeof newFilters?.offset === "number") {
          searchParams.set("offset", newFilters.offset.toString());
        }
        if (typeof newFilters?.limit === "number") {
          searchParams.set("limit", newFilters.limit.toString());
        }
        if (newFilters?.sortBy) searchParams.set("sortBy", newFilters.sortBy);
        if (newFilters?.sortOrder)
          searchParams.set("sortOrder", newFilters.sortOrder);

        const newKey = `/api/offices?${searchParams.toString()}`;
        return mutate(officesFetcher(newKey));
      }
      return mutate();
    },
    [organizationSlug, mutate],
  );

  const refreshOffices = useCallback(() => {
    return mutate();
  }, [mutate]);

  return {
    offices: offices ?? [],
    isLoading: isInitialLoading,
    error: error?.message || null,
    errorStatus: error?.status || null,
    isUnauthorized: error?.status === 401,
    hasAccessError: error?.status === 403 || error?.status === 404,
    fetchOffices,
    refreshOffices,
  };
}
